import pool from '../config/database.js';
import { CHAT_SYSTEM_PROMPT, buildChatContextMessage, callLLM, safeJsonParse } from './ai.js';
import type { ChatContext } from './ai.js';
import { getUserLlmConfig } from './settings.js';

// 兼容旧导出
export { buildChatContextMessage as buildContextMessage, CHAT_SYSTEM_PROMPT };
export type { ChatContext };

// ============ 核心 AI 聊天 ============
export async function chatWithAI(
  userId: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext
): Promise<string> {
  const llmConfig = await getUserLlmConfig(userId);
  if (!llmConfig) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const contextMessage = buildChatContextMessage(context);

  const systemPrompt = CHAT_SYSTEM_PROMPT + '\n\n' + contextMessage;

  const historyStr = history.slice(-10)
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
    .join('\n\n');

  const userMessage = `${historyStr ? historyStr + '\n\n' : ''}用户: ${message}`;

  try {
    const response = await callLLM(llmConfig, systemPrompt, userMessage, {
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
    });
    return response || '抱歉，我暂时无法回答这个问题。';
  } catch (error: any) {
    console.error('AI chat error:', error?.message || error);
    throw new Error(`AI 调用失败：${error?.message || '未知错误'}`);
  }
}

// ============ 聊天数据操作 ============
export async function loadChatHistory(userId: string): Promise<any[]> {
  const [messages] = await pool.execute(
    'SELECT * FROM chat_messages WHERE user_id = ? ORDER BY timestamp ASC',
    [userId]
  );
  const [refs] = await pool.execute(
    'SELECT cr.* FROM chat_references cr JOIN chat_messages cm ON cr.message_id = cm.id WHERE cm.user_id = ?',
    [userId]
  );

  const refMap = new Map<string, any[]>();
  (refs as any[]).forEach((r) => {
    if (!refMap.has(r.message_id)) refMap.set(r.message_id, []);
    refMap.get(r.message_id)!.push({ type: r.ref_type, id: r.ref_id });
  });

  return (messages as any[]).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    references: refMap.get(m.id) || [],
  }));
}

export async function loadUserContext(userId: string): Promise<ChatContext> {
  const [files] = await pool.execute(`
    SELECT f.name, f.type, GROUP_CONCAT(ft.tag) as tags
    FROM files f LEFT JOIN file_tags ft ON f.id = ft.file_id
    WHERE f.user_id = ?
    GROUP BY f.id
  `, [userId]);
  const [todos] = await pool.execute(
    'SELECT title, status, priority, due_date FROM todos WHERE user_id = ?',
    [userId]
  );
  const [notes] = await pool.execute(
    'SELECT title, content FROM notes WHERE user_id = ?',
    [userId]
  );

  return {
    files: (files as any[]).map(f => ({ name: f.name, type: f.type, tags: f.tags ? f.tags.split(',') : [] })),
    todos: (todos as any[]).map(t => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.due_date })),
    notes: (notes as any[]).map(n => ({ title: n.title, content: n.content })),
  };
}

export async function saveUserMessage(userId: string, msgId: string, content: string): Promise<Date> {
  const now = new Date();
  await pool.execute(
    'INSERT INTO chat_messages (id, role, content, timestamp, user_id) VALUES (?, ?, ?, ?, ?)',
    [msgId, 'user', content, now, userId]
  );
  return now;
}

export async function saveAiMessage(userId: string, msgId: string, content: string): Promise<Date> {
  const now = new Date();
  await pool.execute(
    'INSERT INTO chat_messages (id, role, content, timestamp, user_id) VALUES (?, ?, ?, ?, ?)',
    [msgId, 'assistant', content, now, userId]
  );
  return now;
}

export async function createChatTimelineEvent(userId: string): Promise<void> {
  await pool.execute(
    'INSERT INTO timeline_events (id, type, title, timestamp, user_id) VALUES (?, ?, ?, ?, ?)',
    [`te-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, 'chat', '与 AI 助手进行了对话', new Date(), userId]
  );
}

// ============ AI 规划方向 ============
const PLAN_SYSTEM_PROMPT = `你是 Old Z 的 AI 策略规划师。用户设定了成长目标，你需要：
1. 分析目标的可行路径
2. 给出 3-6 句主线策略（main_line），像主线任务一样指引方向
3. 给出 1-3 条今天可以立即执行的行动建议（today_actions）

请输出严格 JSON 格式：
{
  "main_line": "这里是3-6句话的主线策略...",
  "today_actions": [
    "今天可以做的具体行动1",
    "今天可以做的具体行动2"
  ]
}`;

function buildPlanUserMessage(goal: string, context: string, stages: any[]): string {
  const stageText = (stages && stages.length > 0)
    ? stages.map((s: any, i: number) => `${i + 1}. ${s.title || '阶段'} [${s.status || 'active'}]`).join('\n')
    : '（暂无阶段）';

  return `目标：${goal}
背景：${context || '无'}
当前阶段：
${stageText}

请帮我制定主线策略和今日行动。`;
}

export async function planDirection(
  userId: string,
  goal: string,
  context: string,
  stages: any[]
): Promise<{ main_line: string; today_actions: string[] }> {
  const llmConfig = await getUserLlmConfig(userId);
  if (!llmConfig) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const systemPrompt = PLAN_SYSTEM_PROMPT;
  const userMessage = buildPlanUserMessage(goal, context, stages);

  let llmResult: string;
  try {
    llmResult = await callLLM(llmConfig, systemPrompt, userMessage, { jsonMode: true, timeoutMs: 25000 });
  } catch (llmErr: any) {
    console.error('LLM plan call failed:', llmErr?.message || llmErr);
    throw new Error(`AI 调用失败：${llmErr?.message || '未知错误'}`);
  }

  const parsed = safeJsonParse(llmResult);
  if (!parsed || !parsed.main_line) {
    throw new Error('AI 返回结果解析失败，请重试');
  }

  return {
    main_line: parsed.main_line || '',
    today_actions: Array.isArray(parsed.today_actions) ? parsed.today_actions : [],
  };
}
