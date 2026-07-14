import db from '../config/db.js';
import {
  ACTION_SUGGESTION_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  TOOL_CHAT_SYSTEM_PROMPT,
  buildActionSuggestionUserMessage,
  buildChatContextMessage,
  callLLM,
  callLLMStream,
  callLLMWithTools,
  callLLMStreamWithTools,
  safeJsonParse,
} from './ai.js';
import type { ChatMessage, ToolCallResult } from './ai.js';
import { getToolDefinitions, executeToolCall } from './tools.js';
import type { AiActionSuggestion } from './ai.js';
import type { ChatContext } from './ai.js';
import { getUserLlmConfig } from './settings.js';

// 兼容旧导出
export { buildChatContextMessage as buildContextMessage, CHAT_SYSTEM_PROMPT };
export type { ChatContext };

export type ChatScope = 'global' | 'note';
export interface ChatHistoryOptions {
  scope?: ChatScope;
  noteId?: string;
  conversationId?: string;
}

export interface ChatConversationOptions {
  scope?: ChatScope;
  noteId?: string;
  title?: string;
}

export interface ChatReferenceInput {
  type: 'file' | 'note' | 'todo';
  id: string;
}

export interface ChatReferenceDetail extends ChatReferenceInput {
  title: string;
  context: string;
}

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

// ============ 流式 AI 聊天 ============
export async function chatWithAIStream(
  userId: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext,
  onChunk: (text: string) => void
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
    const response = await callLLMStream(llmConfig, systemPrompt, userMessage, onChunk, {
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 60000,
    });
    return response || '抱歉，我暂时无法回答这个问题。';
  } catch (error: any) {
    console.error('AI chat stream error:', error?.message || error);
    throw new Error(`AI 调用失败：${error?.message || '未知错误'}`);
  }
}

export async function generateTextWithAI(userId: string, prompt: string): Promise<string> {
  const llmConfig = await getUserLlmConfig(userId);
  if (!llmConfig) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  try {
    const response = await callLLM(
      llmConfig,
      '你是 Old Z 的内容生成助手。请严格根据用户提供的材料生成内容，不要读取或假设任何聊天历史，不要编造未提供的信息。',
      prompt,
      {
        temperature: 0.4,
        maxTokens: 4096,
        timeoutMs: 30000,
      }
    );
    return response || '抱歉，我暂时无法生成内容。';
  } catch (error: any) {
    console.error('AI generate error:', error?.message || error);
    throw new Error(`AI 调用失败：${error?.message || '未知错误'}`);
  }
}

function normalizeActionSuggestion(action: any): AiActionSuggestion | null {
  if (!action || !['todo', 'note', 'reminder'].includes(action.type)) return null;
  const title = String(action.title || '').trim().slice(0, 120);
  if (!title) return null;

  const priority = ['low', 'medium', 'high', 'urgent'].includes(action.priority)
    ? action.priority
    : 'medium';
  const tags = Array.isArray(action.tags)
    ? action.tags.map((tag: any) => String(tag).trim()).filter(Boolean).slice(0, 6)
    : ['ai'];

  return {
    type: action.type,
    title,
    description: action.description ? String(action.description).trim().slice(0, 1000) : undefined,
    priority,
    tags,
    content: action.content ? String(action.content).trim().slice(0, 6000) : undefined,
  };
}

export async function suggestChatActions(
  userId: string,
  message: string,
  aiReply: string
): Promise<AiActionSuggestion[]> {
  const llmConfig = await getUserLlmConfig(userId);
  if (!llmConfig) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const context = await loadUserContext(userId);
  const userMessage = buildActionSuggestionUserMessage(message, aiReply, context);
  const llmResult = await callLLM(llmConfig, ACTION_SUGGESTION_SYSTEM_PROMPT, userMessage, {
    temperature: 0.2,
    maxTokens: 1600,
    jsonMode: true,
    timeoutMs: 25000,
  });

  const parsed = safeJsonParse(llmResult);
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  return actions
    .map((action: any) => normalizeActionSuggestion(action))
    .filter((action: AiActionSuggestion | null): action is AiActionSuggestion => Boolean(action))
    .slice(0, 4);
}

// ============ 聊天数据操作 ============
function conversationId(): string {
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createChatConversation(
  userId: string,
  options: ChatConversationOptions = {}
): Promise<any> {
  const id = conversationId();
  const now = new Date();
  const scope = options.scope || 'global';
  const title = (options.title || '新对话').trim().slice(0, 200) || '新对话';
  await db.execute(
    'INSERT INTO chat_conversations (id, user_id, title, scope, note_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, title, scope, options.noteId || null, now, now]
  );
  return { id, title, scope, noteId: options.noteId, createdAt: now, updatedAt: now, messageCount: 0 };
}

export async function ensureChatConversation(
  userId: string,
  options: ChatConversationOptions & { conversationId?: string } = {}
): Promise<any> {
  if (options.conversationId) {
    const [rows] = await db.execute(
      'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ? LIMIT 1',
      [options.conversationId, userId]
    );
    const conversation = (rows as any[])[0];
    if (conversation) {
      return {
        id: conversation.id,
        title: conversation.title,
        scope: conversation.scope || 'global',
        noteId: conversation.note_id || undefined,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      };
    }
  }

  const scope = options.scope || 'global';
  const noteId = scope === 'note' ? options.noteId || null : null;
  const [rows] = await db.execute(
    `SELECT * FROM chat_conversations
     WHERE user_id = ? AND scope = ? AND ${noteId ? 'note_id = ?' : 'note_id IS NULL'}
     ORDER BY updated_at DESC
     LIMIT 1`,
    noteId ? [userId, scope, noteId] : [userId, scope]
  );
  const existing = (rows as any[])[0];
  if (existing) {
    return {
      id: existing.id,
      title: existing.title,
      scope: existing.scope || 'global',
      noteId: existing.note_id || undefined,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  return createChatConversation(userId, { scope, noteId: noteId || undefined, title: options.title });
}

export async function loadChatConversations(userId: string): Promise<any[]> {
  await ensureLegacyDefaultConversation(userId);
  const [rows] = await db.execute(
    `SELECT c.*, COUNT(cm.id) AS message_count, MAX(cm.timestamp) AS last_message_at
     FROM chat_conversations c
     LEFT JOIN chat_messages cm ON cm.conversation_id = c.id AND cm.user_id = c.user_id
     WHERE c.user_id = ?
     GROUP BY c.id
     ORDER BY COALESCE(MAX(cm.timestamp), c.updated_at) DESC`,
    [userId]
  );

  return (rows as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    scope: row.scope || 'global',
    noteId: row.note_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: Number(row.message_count || 0),
    lastMessageAt: row.last_message_at || undefined,
  }));
}

async function ensureLegacyDefaultConversation(userId: string): Promise<void> {
  const [orphans] = await db.execute(
    'SELECT COUNT(*) AS count FROM chat_messages WHERE user_id = ? AND conversation_id IS NULL',
    [userId]
  );
  const count = Number((orphans as any[])[0]?.count || 0);
  if (count === 0) return;

  const [existingRows] = await db.execute(
    `SELECT * FROM chat_conversations
     WHERE user_id = ? AND title = ? AND scope = 'global'
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId, '默认对话']
  );
  let conversation = (existingRows as any[])[0];
  if (!conversation) {
    conversation = await createChatConversation(userId, { title: '默认对话', scope: 'global' });
  }
  await db.execute(
    'UPDATE chat_messages SET conversation_id = ? WHERE user_id = ? AND conversation_id IS NULL',
    [conversation.id, userId]
  );
}

export async function renameChatConversation(userId: string, id: string, title: string): Promise<void> {
  await db.execute(
    'UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [title.trim().slice(0, 200) || '未命名对话', new Date(), id, userId]
  );
}

export async function deleteChatConversation(userId: string, id: string): Promise<void> {
  await db.execute('DELETE FROM chat_messages WHERE conversation_id = ? AND user_id = ?', [id, userId]);
  await db.execute('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function touchChatConversation(userId: string, id: string, firstUserMessage?: string): Promise<void> {
  const [rows] = await db.execute(
    'SELECT title FROM chat_conversations WHERE id = ? AND user_id = ? LIMIT 1',
    [id, userId]
  );
  const conversation = (rows as any[])[0];
  const shouldTitle = conversation && conversation.title === '新对话' && firstUserMessage;
  await db.execute(
    `UPDATE chat_conversations
     SET updated_at = ?${shouldTitle ? ', title = ?' : ''}
     WHERE id = ? AND user_id = ?`,
    shouldTitle
      ? [new Date(), firstUserMessage!.trim().slice(0, 32), id, userId]
      : [new Date(), id, userId]
  );
}

export async function loadChatHistory(userId: string, options: ChatHistoryOptions = {}): Promise<any[]> {
  const params: any[] = [userId];
  let where = 'cm.user_id = ?';

  if (options.conversationId) {
    where += ' AND cm.conversation_id = ?';
    params.push(options.conversationId);
  }

  if (options.scope === 'global') {
    where += " AND COALESCE(cm.scope, 'global') = 'global'";
  } else if (options.scope === 'note') {
    where += " AND cm.scope = 'note'";
    if (options.noteId) {
      where += ' AND cm.note_id = ?';
      params.push(options.noteId);
    }
  }

  const [messages] = await db.execute(
    `SELECT cm.*, n.title AS note_title
     FROM chat_messages cm
     LEFT JOIN notes n ON cm.note_id = n.id AND n.user_id = cm.user_id
     WHERE ${where}
     ORDER BY cm.timestamp ASC`,
    params
  );
  const [refs] = await db.execute(
    `SELECT cr.*,
      COALESCE(n.title, t.title, f.name, cr.ref_id) AS ref_title
     FROM chat_references cr
     JOIN chat_messages cm ON cr.message_id = cm.id
     LEFT JOIN notes n ON cr.ref_type = 'note' AND cr.ref_id = n.id AND n.user_id = cm.user_id
     LEFT JOIN todos t ON cr.ref_type = 'todo' AND cr.ref_id = t.id AND t.user_id = cm.user_id
     LEFT JOIN files f ON cr.ref_type = 'file' AND cr.ref_id = f.id AND f.user_id = cm.user_id
     WHERE cm.user_id = ?`,
    [userId]
  );

  const refMap = new Map<string, any[]>();
  (refs as any[]).forEach((r) => {
    if (!refMap.has(r.message_id)) refMap.set(r.message_id, []);
    refMap.get(r.message_id)!.push({ type: r.ref_type, id: r.ref_id, title: r.ref_title || r.ref_id });
  });

  return (messages as any[]).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    scope: m.scope || 'global',
    noteId: m.note_id || undefined,
    noteTitle: m.note_title || undefined,
    conversationId: m.conversation_id || undefined,
    references: refMap.get(m.id) || [],
  }));
}

export async function loadUserContext(userId: string): Promise<ChatContext> {
  const [files] = await db.execute(`
    SELECT f.name, f.type, GROUP_CONCAT(ft.tag) as tags
    FROM files f LEFT JOIN file_tags ft ON f.id = ft.file_id
    WHERE f.user_id = ?
    GROUP BY f.id
  `, [userId]);
  const [todos] = await db.execute(
    'SELECT title, status, priority, due_date FROM todos WHERE user_id = ?',
    [userId]
  );
  const [notes] = await db.execute(
    'SELECT title, content FROM notes WHERE user_id = ?',
    [userId]
  );

  return {
    files: (files as any[]).map(f => ({ name: f.name, type: f.type, tags: f.tags ? f.tags.split(',') : [] })),
    todos: (todos as any[]).map(t => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.due_date })),
    notes: (notes as any[]).map(n => ({ title: n.title, content: n.content })),
  };
}

export async function loadNoteContext(userId: string, noteId: string): Promise<ChatContext> {
  const [notes] = await db.execute(
    'SELECT title, content FROM notes WHERE id = ? AND user_id = ?',
    [noteId, userId]
  );
  const note = (notes as any[])[0];
  if (!note) {
    throw new Error('笔记不存在或无权访问');
  }

  return {
    files: [],
    todos: [],
    notes: [{ title: note.title, content: note.content }],
  };
}

export async function loadNoteMeta(userId: string, noteId: string): Promise<{ id: string; title: string }> {
  const [notes] = await db.execute(
    'SELECT id, title FROM notes WHERE id = ? AND user_id = ?',
    [noteId, userId]
  );
  const note = (notes as any[])[0];
  if (!note) {
    throw new Error('笔记不存在或无权访问');
  }
  return { id: note.id, title: note.title };
}

/** 可通过 fetch 读取为文本的文件扩展名 */
const TEXT_READABLE_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'xml', 'csv', 'html', 'htm', 'css', 'svg',
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'yml', 'yaml', 'toml', 'ini', 'conf', 'cfg', 'log', 'env',
  'sql', 'graphql', 'proto',
  'vue', 'svelte', 'astro',
]);

function isTextReadableFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return TEXT_READABLE_EXTENSIONS.has(ext);
}

export function normalizeChatReferences(input: any): ChatReferenceInput[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const refs: ChatReferenceInput[] = [];
  input.forEach((item) => {
    const type = item?.type;
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (!['file', 'note', 'todo'].includes(type) || !id) return;
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ type, id });
  });
  return refs.slice(0, 12);
}

function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

export async function loadChatReferenceDetails(
  userId: string,
  references: ChatReferenceInput[]
): Promise<ChatReferenceDetail[]> {
  const details = new Map<string, ChatReferenceDetail>();

  const noteIds = references.filter((ref) => ref.type === 'note').map((ref) => ref.id);
  if (noteIds.length > 0) {
    const [rows] = await db.execute(
      `SELECT id, title, content FROM notes WHERE user_id = ? AND id IN (${sqlPlaceholders(noteIds.length)})`,
      [userId, ...noteIds]
    );
    (rows as any[]).forEach((note) => {
      details.set(`note:${note.id}`, {
        type: 'note',
        id: note.id,
        title: note.title,
        context: `笔记《${note.title}》\n${String(note.content || '').slice(0, 6000)}`,
      });
    });
  }

  const todoIds = references.filter((ref) => ref.type === 'todo').map((ref) => ref.id);
  if (todoIds.length > 0) {
    const [rows] = await db.execute(
      `SELECT id, title, description, priority, status, due_date FROM todos WHERE user_id = ? AND id IN (${sqlPlaceholders(todoIds.length)})`,
      [userId, ...todoIds]
    );
    (rows as any[]).forEach((todo) => {
      details.set(`todo:${todo.id}`, {
        type: 'todo',
        id: todo.id,
        title: todo.title,
        context: [
          `待办《${todo.title}》`,
          `状态：${todo.status}；优先级：${todo.priority}${todo.due_date ? `；截止：${todo.due_date}` : ''}`,
          todo.description ? `描述：${todo.description}` : '',
        ].filter(Boolean).join('\n'),
      });
    });
  }

  const fileIds = references.filter((ref) => ref.type === 'file').map((ref) => ref.id);
  if (fileIds.length > 0) {
    const [rows] = await db.execute(
      `SELECT f.id, f.name, f.type, f.size, f.content, f.url, GROUP_CONCAT(ft.tag) AS tags
       FROM files f
       LEFT JOIN file_tags ft ON ft.file_id = f.id
       WHERE f.user_id = ? AND f.id IN (${sqlPlaceholders(fileIds.length)})
       GROUP BY f.id`,
      [userId, ...fileIds]
    );

    // 对文本类文件，如果 content 为空但有 OSS URL，尝试实时抓取内容
    const contentFetchPromises = (rows as any[]).map(async (file) => {
      if (file.content || !file.url) return file;
      if (!isTextReadableFile(file.name)) return file;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(file.url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return file;
        const text = await res.text();
        const trimmed = text.trim().slice(0, 500_000);
        if (trimmed) {
          // 缓存到数据库，下次引用无需再抓取
          db.execute('UPDATE files SET content = ? WHERE id = ?', [trimmed, file.id])
            .catch(() => { /* 静默失败，不阻塞主流程 */ });
          return { ...file, content: trimmed };
        }
      } catch (e: any) {
        console.error(`[chat] Failed to fetch file content for ${file.name}:`, e?.message || e);
      }
      return file;
    });

    const filesWithContent = await Promise.all(contentFetchPromises);

    filesWithContent.forEach((file) => {
      const tags = file.tags ? `；标签：${file.tags}` : '';
      const content = file.content ? `\n内容：${String(file.content).slice(0, 6000)}` : '';
      details.set(`file:${file.id}`, {
        type: 'file',
        id: file.id,
        title: file.name,
        context: `文件《${file.name}》\n类型：${file.type}；大小：${file.size || 0} bytes${tags}${file.url ? `；链接：${file.url}` : ''}${content}`,
      });
    });
  }

  return references
    .map((ref) => details.get(`${ref.type}:${ref.id}`))
    .filter((ref): ref is ChatReferenceDetail => Boolean(ref));
}

export function buildReferencedPrompt(content: string, references: ChatReferenceDetail[]): string {
  if (references.length === 0) return content;
  return [
    '本轮用户显式引用了以下资料。回答时优先使用这些引用；如果引用资料不足，请明确说明不足，不要编造。',
    references.map((ref, index) => `## 引用 ${index + 1}：${ref.context}`).join('\n\n'),
    '',
    '用户问题：',
    content,
  ].join('\n');
}

export async function saveChatReferences(messageId: string, references: ChatReferenceDetail[]): Promise<void> {
  if (references.length === 0) return;
  await Promise.all(references.map((ref) => db.execute(
    'INSERT OR IGNORE INTO chat_references (message_id, ref_type, ref_id) VALUES (?, ?, ?)',
    [messageId, ref.type, ref.id]
  )));
}

export async function saveUserMessage(
  userId: string,
  msgId: string,
  content: string,
  options: ChatHistoryOptions = {}
): Promise<Date> {
  const now = new Date();
  await db.execute(
    'INSERT INTO chat_messages (id, role, content, timestamp, user_id, scope, note_id, conversation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [msgId, 'user', content, now, userId, options.scope || 'global', options.noteId || null, options.conversationId || null]
  );
  return now;
}

export async function saveAiMessage(
  userId: string,
  msgId: string,
  content: string,
  options: ChatHistoryOptions = {}
): Promise<Date> {
  const now = new Date();
  await db.execute(
    'INSERT INTO chat_messages (id, role, content, timestamp, user_id, scope, note_id, conversation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [msgId, 'assistant', content, now, userId, options.scope || 'global', options.noteId || null, options.conversationId || null]
  );
  return now;
}

export async function deleteChatMessage(userId: string, messageId: string): Promise<boolean> {
  const [result] = await db.execute(
    'DELETE FROM chat_messages WHERE id = ? AND user_id = ?',
    [messageId, userId]
  );
  return (result as any).affectedRows > 0;
}

export async function deleteLastExchange(userId: string, conversationId: string): Promise<number> {
  // 找到该对话最后一条用户消息和 AI 回复，一并删除
  const [userMsgs] = await db.execute(
    `SELECT id FROM chat_messages
     WHERE user_id = ? AND conversation_id = ? AND role = 'user'
     ORDER BY timestamp DESC LIMIT 1`,
    [userId, conversationId]
  );
  const [aiMsgs] = await db.execute(
    `SELECT id FROM chat_messages
     WHERE user_id = ? AND conversation_id = ? AND role = 'assistant'
     ORDER BY timestamp DESC LIMIT 1`,
    [userId, conversationId]
  );

  let deleted = 0;
  for (const row of [...(userMsgs as any[]), ...(aiMsgs as any[])]) {
    const [r] = await db.execute('DELETE FROM chat_messages WHERE id = ? AND user_id = ?', [row.id, userId]);
    deleted += (r as any).affectedRows;
  }
  return deleted;
}

export async function createChatTimelineEvent(userId: string): Promise<void> {
  await db.execute(
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

// ============ Tool-Calling AI 聊天 ============

const MAX_TOOL_TURNS = 5;

/**
 * 带工具的非流式 AI 聊天。
 * AI 可以自主调用搜索工具来查找用户的知识库。
 */
export async function chatWithAIToolMode(
  userId: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext
): Promise<string> {
  const llmConfig = await getUserLlmConfig(userId);
  if (!llmConfig) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const tools = getToolDefinitions();
  const contextMessage = buildChatContextMessage(context);

  // 构建消息列表
  const messages: ChatMessage[] = [
    { role: 'system', content: TOOL_CHAT_SYSTEM_PROMPT + '\n\n' + contextMessage },
  ];

  // 添加历史消息
  for (const h of history.slice(-20)) {
    messages.push({ role: h.role, content: h.content });
  }

  // 添加用户消息
  messages.push({ role: 'user', content: message });

  // Tool loop
  let turn = 0;
  while (turn < MAX_TOOL_TURNS) {
    turn++;

    const result: ToolCallResult = await callLLMWithTools(llmConfig, messages, tools, {
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 30000,
    });

    // 没有 tool calls → 返回文本回复
    if (result.toolCalls.length === 0) {
      return result.content || '抱歉，我暂时无法回答这个问题。';
    }

    // 添加 AI 消息（含 tool_calls）
    messages.push({
      role: 'assistant',
      content: result.content || '',
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    // 执行每个 tool call 并添加结果
    for (const tc of result.toolCalls) {
      let toolResult: string;
      try {
        const args = JSON.parse(tc.arguments);
        toolResult = await executeToolCall(tc.name, args, userId);
      } catch (e: any) {
        toolResult = JSON.stringify({ error: `工具执行失败：${e?.message || '未知错误'}` });
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.name,
        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
      });
    }
  }

  // 超过最大轮数 → 最后请求 AI 总结
  messages.push({
    role: 'user',
    content: '请基于以上工具调用结果，给我一个完整的回答。',
  });

  const finalResult = await callLLMWithTools(llmConfig, messages, [], {
    temperature: 0.7,
    maxTokens: 4096,
    timeoutMs: 30000,
  });

  return finalResult.content || '抱歉，我暂时无法回答这个问题。';
}

/**
 * 带工具的流式 AI 聊天。
 * 工具调用在后台执行，流式输出最终回复。
 */
export async function chatWithAIToolModeStream(
  userId: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext,
  onChunk: (text: string) => void
): Promise<string> {
  const llmConfig = await getUserLlmConfig(userId);
  if (!llmConfig) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const tools = getToolDefinitions();
  const contextMessage = buildChatContextMessage(context);

  // 构建消息列表
  const messages: ChatMessage[] = [
    { role: 'system', content: TOOL_CHAT_SYSTEM_PROMPT + '\n\n' + contextMessage },
  ];

  for (const h of history.slice(-20)) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({ role: 'user', content: message });

  // 第一轮：流式获取 AI 回复
  let turn = 0;
  let finalContent = '';

  while (turn < MAX_TOOL_TURNS) {
    turn++;

    const result = await callLLMStreamWithTools(llmConfig, messages, tools, onChunk, {
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 60000,
    });

    finalContent = result.content;

    // 没有 tool calls → 完成
    if (result.toolCalls.length === 0) {
      return finalContent || '抱歉，我暂时无法回答这个问题。';
    }

    // 有 tool calls → 静默执行，不流式输出中间结果
    messages.push({
      role: 'assistant',
      content: result.content || '',
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const tc of result.toolCalls) {
      let toolResult: string;
      try {
        const args = JSON.parse(tc.arguments);
        toolResult = await executeToolCall(tc.name, args, userId);
      } catch (e: any) {
        toolResult = JSON.stringify({ error: `工具执行失败：${e?.message || '未知错误'}` });
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.name,
        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
      });
    }

    // 通知前端工具执行完成
    onChunk('\n\n---\n*正在搜索知识库...*\n\n');
  }

  // 达到最大轮数 → 最后无工具流式输出
  messages.push({
    role: 'user',
    content: '请基于以上工具调用结果，给我一个完整的回答。',
  });

  const finalResult = await callLLMStreamWithTools(llmConfig, messages, [], onChunk, {
    temperature: 0.7,
    maxTokens: 4096,
    timeoutMs: 60000,
  });

  return finalResult.content || '抱歉，我暂时无法回答这个问题。';
}
