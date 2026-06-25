import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'tp-c5vzlvfo615zku0cqxzgw6rn9x12d8e397542w3u1fodw0uq',
  baseURL: 'https://token-plan-cn.xiaomimimo.com/v1',
});

const SYSTEM_PROMPT = `你是 Old Z（老周）的 AI 助手，一款融合笔记、待办、文件管理、个人数字大脑的效率应用。

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

export interface ChatContext {
  files: { name: string; type: string; tags: string[] }[];
  todos: { title: string; status: string; priority: string; dueDate?: string }[];
  notes: { title: string; content: string }[];
}

export async function chatWithAI(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext
): Promise<string> {
  const contextMessage = buildContextMessage(context);

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT + '\n\n' + contextMessage },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const response = await client.chat.completions.create({
      model: 'mimo-v2.5-pro',
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
  } catch (error: any) {
    console.error('AI chat error:', error?.message || error);
    return 'AI 调用失败，请稍后重试。';
  }
}

function buildContextMessage(ctx: ChatContext): string {
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
