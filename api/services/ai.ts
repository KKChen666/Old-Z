import OpenAI from 'openai';

// ============ OpenAI 兼容 LLM 调用 ============
export async function callOpenAiCompatibleLLM(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean; timeoutMs?: number }
): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`,
    timeout: options?.timeoutMs || 20000,
  });

  const params: any = {
    model,
    messages: [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ],
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens || 4096,
  };

  if (options?.jsonMode) {
    params.response_format = { type: 'json_object' };
  }

  const response = await client.chat.completions.create(params);
  return response.choices[0]?.message?.content || '';
}

// ============ Anthropic 兼容 LLM 调用 ============
export async function callAnthropicCompatibleLLM(
  baseUrl: string,
  authToken: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  options?: { timeoutMs?: number }
): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/v1/messages`;
  const timeoutMs = options?.timeoutMs || 20000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authToken,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }

    const json: any = await res.json();
    return json?.content?.[0]?.text || json?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ============ 通用 LLM 调用（根据 provider 分发）============
export interface LlmProviderConfig {
  provider: 'openai' | 'anthropic';
  openai_base_url: string;
  openai_api_key: string;
  openai_model: string;
  anthropic_base_url: string;
  anthropic_auth_token: string;
  anthropic_model: string;
}

export async function callLLM(
  config: LlmProviderConfig,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean; timeoutMs?: number }
): Promise<string> {
  if (config.provider === 'anthropic') {
    return callAnthropicCompatibleLLM(
      config.anthropic_base_url || 'https://api.anthropic.com',
      config.anthropic_auth_token,
      config.anthropic_model || 'claude-sonnet-4-5',
      systemPrompt,
      userMessage,
      { timeoutMs: options?.timeoutMs }
    );
  }
  return callOpenAiCompatibleLLM(
    config.openai_base_url || 'https://api.openai.com',
    config.openai_api_key,
    config.openai_model || 'gpt-4.1-mini',
    systemPrompt,
    userMessage,
    options
  );
}

// ============ 安全的 JSON 解析（容错 LLM 输出）============
export function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    return null;
  }
}

// ============ 流式 LLM 调用（SSE 逐 chunk 返回）============
export async function callLLMStream(
  config: LlmProviderConfig,
  systemPrompt: string,
  userMessage: string,
  onChunk: (text: string) => void,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string> {
  const fullText: string[] = [];

  if (config.provider === 'anthropic') {
    // Anthropic 流式
    const cleanBase = (config.anthropic_base_url || 'https://api.anthropic.com').replace(/\/+$/, '');
    const url = `${cleanBase}/v1/messages`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options?.timeoutMs || 60000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropic_auth_token,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.anthropic_model || 'claude-sonnet-4-5',
          max_tokens: options?.maxTokens || 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Anthropic API error ${res.status}: ${errText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.type === 'content_block_delta' && json.delta?.text) {
                fullText.push(json.delta.text);
                onChunk(json.delta.text);
              }
            } catch { /* skip non-JSON lines */ }
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } else {
    // OpenAI 流式
    const client = new OpenAI({
      apiKey: config.openai_api_key,
      baseURL: config.openai_base_url?.endsWith('/v1')
        ? config.openai_base_url
        : `${config.openai_base_url || 'https://api.openai.com'}/v1`,
      timeout: options?.timeoutMs || 60000,
    });

    const stream = await client.chat.completions.create({
      model: config.openai_model || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullText.push(content);
        onChunk(content);
      }
    }
  }

  return fullText.join('');
}

// ============ 带 Tool Calling 的 LLM 调用 ============

export interface ToolCallResult {
  content: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

/**
 * 带工具的非流式 LLM 调用。
 * 返回 AI 的文本回复和可能的 tool_calls。
 */
export async function callLLMWithTools(
  config: LlmProviderConfig,
  messages: ChatMessage[],
  tools: any[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<ToolCallResult> {
  if (config.provider === 'anthropic') {
    // Anthropic 的 tool_use 格式不同，暂不支持
    // 降级为普通调用，移除 tools
    const content = await callLLM(
      config,
      messages.find(m => m.role === 'system')?.content || '',
      messages.filter(m => m.role === 'user').map(m => m.content).join('\n'),
      options
    );
    return { content, toolCalls: [] };
  }

  return callOpenAiCompatibleLLMWithTools(config, messages, tools, options);
}

/**
 * OpenAI-compatible 带工具的 LLM 调用（非流式）。
 */
async function callOpenAiCompatibleLLMWithTools(
  config: LlmProviderConfig,
  messages: ChatMessage[],
  tools: any[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<ToolCallResult> {
  const client = new OpenAI({
    apiKey: config.openai_api_key,
    baseURL: config.openai_base_url?.endsWith('/v1')
      ? config.openai_base_url
      : `${config.openai_base_url || 'https://api.openai.com'}/v1`,
    timeout: options?.timeoutMs || 30000,
  });

  // 转换消息格式：将 tool role 消息转换为 OpenAI 格式
  const openaiMessages = messages.map((m) => {
    const msg: any = { role: m.role, content: m.content };
    if (m.tool_calls) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (m.name) msg.name = m.name;
    return msg;
  });

  try {
    const response = await client.chat.completions.create({
      model: config.openai_model || 'gpt-4.1-mini',
      messages: openaiMessages as any,
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: t.function || { name: t.name, description: t.description, parameters: t.parameters },
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || '';
    const rawToolCalls = choice?.message?.tool_calls || [];

    const toolCalls = rawToolCalls
      .filter((tc: any) => tc.type === 'function')
      .map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

    return { content, toolCalls };
  } catch (error: any) {
    console.error('OpenAI tool call error:', error?.message || error);
    throw new Error(`AI Tool Call 失败：${error?.message || '未知错误'}`);
  }
}

/**
 * 带工具的流式 LLM 调用（SSE 逐 chunk 返回）。
 * 流式结束后返回累积的 tool_calls。
 */
export async function callLLMStreamWithTools(
  config: LlmProviderConfig,
  messages: ChatMessage[],
  tools: any[],
  onChunk: (text: string) => void,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<ToolCallResult> {
  const fullText: string[] = [];
  const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();

  if (config.provider === 'anthropic') {
    // 降级为非流式+工具
    const result = await callLLMWithTools(config, messages, tools, options);
    onChunk(result.content);
    return result;
  }

  // OpenAI 流式
  const client = new OpenAI({
    apiKey: config.openai_api_key,
    baseURL: config.openai_base_url?.endsWith('/v1')
      ? config.openai_base_url
      : `${config.openai_base_url || 'https://api.openai.com'}/v1`,
    timeout: options?.timeoutMs || 60000,
  });

  const openaiMessages = messages.map((m) => {
    const msg: any = { role: m.role, content: m.content };
    if (m.tool_calls) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    return msg;
  });

  try {
    const stream = await client.chat.completions.create({
      model: config.openai_model || 'gpt-4.1-mini',
      messages: openaiMessages as any,
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: t.function || { name: t.name, description: t.description, parameters: t.parameters },
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullText.push(delta.content);
        onChunk(delta.content);
      }
      // 累积 tool_calls
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, {
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: '',
            });
          }
          const entry = toolCallMap.get(idx)!;
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }
    }
  } catch (error: any) {
    console.error('OpenAI tool stream error:', error?.message || error);
    throw new Error(`AI Tool Stream 失败：${error?.message || '未知错误'}`);
  }

  const toolCalls = Array.from(toolCallMap.values())
    .filter((tc) => tc.name && tc.arguments)
    .map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    }));

  return { content: fullText.join(''), toolCalls };
}

// ============ 聊天系统提示 ============
export const CHAT_SYSTEM_PROMPT = `你是 Old Z（老周）的 AI 助手，一款融合笔记、待办、文件管理、个人数字大脑的效率应用。

你的能力：
1. 分析用户的文件、笔记、待办数据，给出智能建议
2. 帮助用户总结项目进展、规划下一步行动
3. 发现数据之间的关联，主动提醒潜在问题
4. 回答关于项目管理、效率提升的问题

回复风格：
- 简洁专业，使用 Markdown 格式
- 用 **粗体** 标注重要信息
- 用列表整理条目
- 适当使用 emoji 增加可读性
- 如果用户问到具体数据，尝试引用相关内容`;

// ============ 带 Tool Calling 的聊天系统提示 ============
export const TOOL_CHAT_SYSTEM_PROMPT = `你是 Old Z（老周）的 AI 助手，一款融合笔记、待办、文件管理、个人数字大脑的效率应用。

你有能力搜索用户的知识库。当用户的问题需要查找具体信息时，必须主动调用搜索工具；不要让用户预先替你检索。

可用工具：
- get_current_date: 获取当前日期（解析"今天""本周""本月"等相对日期前使用）
- keyword_search: 跨笔记、待办、文件的全局搜索
- search_notes / search_todos / search_files: 限定类型的搜索
- read_note / read_todo / read_file: 读取完整内容
- list_todos: 按状态或优先级列出待办

使用规则：
1. **主动搜索**：当用户问"有没有""记不记得""帮我找""查一下"时，必须先调用搜索工具
2. **限定范围**：如果用户明确提到笔记/待办/文件，使用对应类型的搜索工具
3. **一次提交所有关键词**：将同一搜索的所有关键词在一次调用中提交
4. **补充读取**：搜索结果中的 preview 只是摘要，如果看起来相关，用 read_* 工具读取全文
5. **引用来源**：回答时引用具体的笔记标题、待办名称或文件名

回答只依据工具返回和对话上下文；材料不足时明确说明，不要编造事实。
最终回答使用自然中文和清晰 Markdown 格式。`;

// ============ 聊天上下文类型 ============
export interface ChatContext {
  files: { name: string; type: string; tags: string[] }[];
  todos: { title: string; status: string; priority: string; dueDate?: string }[];
  notes: { title: string; content: string }[];
}

export interface AiActionSuggestion {
  type: 'todo' | 'note' | 'reminder';
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  content?: string;
}

export function buildChatContextMessage(ctx: ChatContext): string {
  const parts: string[] = ['\n---\n用户当前数据：'];

  if (ctx.todos.length > 0) {
    parts.push('\n待办事项：');
    ctx.todos.forEach(t => {
      parts.push(`- [${t.status === 'completed' ? 'x' : ' '}] ${t.title} (优先级: ${t.priority}${t.dueDate ? ', 截止: ' + t.dueDate : ''})`);
    });
  }

  if (ctx.files.length > 0) {
    parts.push('\n文件列表：');
    ctx.files.forEach(f => {
      parts.push(`- ${f.name} (${f.type}, 标签: ${f.tags.join(', ')})`);
    });
  }

  if (ctx.notes.length > 0) {
    parts.push('\n笔记：');
    ctx.notes.forEach(n => {
      parts.push(`- ${n.title}: ${n.content.slice(0, 200)}`);
    });
  }

  parts.push('\n---');
  return parts.join('\n');
}

export const ACTION_SUGGESTION_SYSTEM_PROMPT = `你是 Old Z 的 AI 联动规划器。你会阅读用户问题、AI 回复以及当前项目数据，然后提出可以落地到应用里的动作建议。

只能输出严格 JSON，不要输出 Markdown。格式如下：
{
  "actions": [
    {
      "type": "todo" | "note" | "reminder",
      "title": "不超过 60 个字的标题",
      "description": "可选，给待办或提醒使用的补充说明",
      "priority": "low" | "medium" | "high" | "urgent",
      "tags": ["ai", "可选标签"],
      "content": "可选，给笔记使用的正文"
    }
  ]
}

规则：
- 最多给 4 条建议，只给真正值得落地的动作。
- todo 用于明确下一步行动；note 用于值得沉淀的总结、方案、清单；reminder 用于需要进入时间线的提醒或风险。
- 不要重复当前已存在的待办或笔记。
- 标题必须具体、可执行，不要写“跟进一下”这类空话。
- 如果没有合适动作，返回 {"actions": []}。`;

export function buildActionSuggestionUserMessage(
  userMessage: string,
  aiReply: string,
  ctx: ChatContext
): string {
  return [
    buildChatContextMessage(ctx),
    '\n用户刚才的问题：',
    userMessage,
    '\nAI 刚才的回复：',
    aiReply,
    '\n请基于以上内容给出可落地到 Old Z 的动作建议。'
  ].join('\n');
}
