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

// ============ 聊天上下文类型 ============
export interface ChatContext {
  files: { name: string; type: string; tags: string[] }[];
  todos: { title: string; status: string; priority: string; dueDate?: string }[];
  notes: { title: string; content: string }[];
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
