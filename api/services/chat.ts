import OpenAI from 'openai';
import pool from '../config/database.js';
import { CHAT_SYSTEM_PROMPT, buildChatContextMessage } from './ai.js';
import type { ChatContext } from './ai.js';

// 兼容旧导出
export { buildChatContextMessage as buildContextMessage, CHAT_SYSTEM_PROMPT };
export type { ChatContext };

const CHAT_AI_API_KEY = 'tp-c5vzlvfo615zku0cqxzgw6rn9x12d8e397542w3u1fodw0uq';
const CHAT_AI_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1';
const CHAT_AI_MODEL = 'mimo-v2.5-pro';

const client = new OpenAI({
  apiKey: CHAT_AI_API_KEY,
  baseURL: CHAT_AI_BASE_URL,
});

// ============ 核心 AI 聊天 ============
export async function chatWithAI(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext
): Promise<string> {
  const contextMessage = buildChatContextMessage(context);

  const messages = [
    { role: 'system' as const, content: CHAT_SYSTEM_PROMPT + '\n\n' + contextMessage },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const response = await client.chat.completions.create({
      model: CHAT_AI_MODEL,
      messages: messages as any,
      max_tokens: 2048,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
  } catch (error: any) {
    console.error('AI chat error:', error?.message || error);
    return 'AI 调用失败，请稍后重试。';
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
