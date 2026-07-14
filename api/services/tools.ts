/**
 * AI Tool-Calling 工具定义与执行器。
 *
 * 从 SpringNote ai_openai.rs memory_tools_json() 移植，
 * 适配 Old Z 的数据模型（notes + todos + files）。
 *
 * 工具列表：
 *   1. get_current_date   — 获取当前日期
 *   2. keyword_search     — 全局搜索（notes + todos + files）
 *   3. search_notes       — 限定搜索笔记
 *   4. search_todos       — 限定搜索待办
 *   5. search_files       — 限定搜索文件
 *   6. read_note           — 按 ID 读取笔记全文
 *   7. read_todo           — 按 ID 读取待办详情
 *   8. read_file           — 按 ID 读取文件内容
 *   9. list_todos          — 列出待办（按状态/优先级过滤）
 */

import { searchAll, searchByKind } from './search.js';
import db from '../config/db.js';

// ---- 类型定义 ----

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
      additionalProperties?: boolean;
    };
    strict?: boolean;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

// ---- 工具定义 ----

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_current_date',
        strict: true,
        description:
          '获取当前本地日期、ISO 周标签和周数。在解析"今天"、"昨天"、"本周"、"本月"等相对日期之前使用。',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'keyword_search',
        strict: true,
        description:
          '跨笔记、待办和文件的全局索引搜索。仅当记录类型未知或答案可能跨越多种类型时使用；当用户明确命名了笔记/待办/文件类型时，优先使用限定范围的 search_notes/search_todos/search_files。在一次调用中提交所有关键词。每个关键词必须包含至少两个 Unicode 字符。',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              description: '一次全局搜索所需的所有关键词，按重要性排序。',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'string',
                description: '包含至少两个 Unicode 字符的关键词。',
                minLength: 2,
              },
            },
          },
          required: ['keywords'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_notes',
        strict: true,
        description:
          '仅搜索笔记。当请求限于笔记时使用。在一次调用中提交所有关键词。每个关键词必须包含至少两个 Unicode 字符。',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              description: '一次笔记搜索所需的所有关键词，按重要性排序。',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'string',
                description: '包含至少两个 Unicode 字符的关键词。',
                minLength: 2,
              },
            },
          },
          required: ['keywords'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_todos',
        strict: true,
        description:
          '仅搜索待办事项。当请求限于待办时使用。在一次调用中提交所有关键词。每个关键词必须包含至少两个 Unicode 字符。',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              description: '一次待办搜索所需的所有关键词，按重要性排序。',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'string',
                description: '包含至少两个 Unicode 字符的关键词。',
                minLength: 2,
              },
            },
          },
          required: ['keywords'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_files',
        strict: true,
        description:
          '仅搜索文件。当请求限于文件时使用。在一次调用中提交所有关键词。每个关键词必须包含至少两个 Unicode 字符。',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              description: '一次文件搜索所需的所有关键词，按重要性排序。',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'string',
                description: '包含至少两个 Unicode 字符的关键词。',
                minLength: 2,
              },
            },
          },
          required: ['keywords'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_note',
        strict: true,
        description: '按 ID 读取笔记的完整 Markdown 内容。',
        parameters: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              description: '笔记的 ID。',
            },
          },
          required: ['noteId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_todo',
        strict: true,
        description: '按 ID 读取待办事项的完整详情（标题、描述、优先级、状态、截止日期）。',
        parameters: {
          type: 'object',
          properties: {
            todoId: {
              type: 'string',
              description: '待办的 ID。',
            },
          },
          required: ['todoId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        strict: true,
        description: '按 ID 读取文件的元数据和文本内容（如果是文本文件）。',
        parameters: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: '文件的 ID。',
            },
          },
          required: ['fileId'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_todos',
        strict: true,
        description: '按状态或优先级列出待办事项。用于快速了解待办情况和进度。',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: '按状态过滤：pending（待处理）、in_progress（进行中）、completed（已完成）。不传则返回全部。',
              enum: ['pending', 'in_progress', 'completed'],
            },
            priority: {
              type: 'string',
              description: '按优先级过滤：low、medium、high、urgent。',
              enum: ['low', 'medium', 'high', 'urgent'],
            },
            limit: {
              type: 'integer',
              description: '返回数量上限，默认 20。',
              minimum: 1,
              maximum: 50,
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
    },
  ];
}

// ---- 工具执行 ----

export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  userId: string
): Promise<string> {
  switch (toolName) {
    case 'get_current_date':
      return executeGetCurrentDate();

    case 'keyword_search':
      return executeKeywordSearch(args, userId);

    case 'search_notes':
      return executeSearchNotes(args, userId);

    case 'search_todos':
      return executeSearchTodos(args, userId);

    case 'search_files':
      return executeSearchFiles(args, userId);

    case 'read_note':
      return executeReadNote(args, userId);

    case 'read_todo':
      return executeReadTodo(args, userId);

    case 'read_file':
      return executeReadFile(args, userId);

    case 'list_todos':
      return executeListTodos(args, userId);

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ---- 各工具实现 ----

function executeGetCurrentDate(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  // 计算 ISO 周
  const d = new Date(now);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return JSON.stringify({
    date: dateStr,
    iso_week: `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
    week_number: weekNum,
    day_of_week: now.toLocaleDateString('zh-CN', { weekday: 'long' }),
  });
}

async function executeKeywordSearch(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const rawKeywords = Array.isArray(args.keywords) ? args.keywords : [];
  const keywords = rawKeywords.filter(
    (k: string) => typeof k === 'string' && k.trim().length >= 2
  );

  if (keywords.length === 0) {
    return JSON.stringify({ error: '需要至少一个长度 >= 2 的关键词' });
  }

  // 分别搜索各类型，合并结果
  const allResults: any[] = [];
  for (const kind of ['note', 'todo', 'file'] as const) {
    const results = await searchByKind(kind, keywords, { userId, limit: 10 });
    allResults.push(...results);
  }

  return JSON.stringify({
    total: allResults.length,
    results: allResults.map((r) => ({
      type: r.entityType,
      id: r.entityId,
      title: r.title,
      preview: r.preview,
    })),
  });
}

async function executeSearchNotes(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const rawKeywords = Array.isArray(args.keywords) ? args.keywords : [];
  const keywords = rawKeywords.filter(
    (k: string) => typeof k === 'string' && k.trim().length >= 2
  );

  if (keywords.length === 0) {
    return JSON.stringify({ error: '需要至少一个长度 >= 2 的关键词' });
  }

  const results = await searchByKind('note', keywords, { userId, limit: 15 });

  return JSON.stringify({
    total: results.length,
    notes: results.map((r) => ({
      id: r.entityId,
      title: r.title,
      preview: r.preview,
    })),
  });
}

async function executeSearchTodos(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const rawKeywords = Array.isArray(args.keywords) ? args.keywords : [];
  const keywords = rawKeywords.filter(
    (k: string) => typeof k === 'string' && k.trim().length >= 2
  );

  if (keywords.length === 0) {
    return JSON.stringify({ error: '需要至少一个长度 >= 2 的关键词' });
  }

  const results = await searchByKind('todo', keywords, { userId, limit: 15 });

  return JSON.stringify({
    total: results.length,
    todos: results.map((r) => ({
      id: r.entityId,
      title: r.title,
      preview: r.preview,
    })),
  });
}

async function executeSearchFiles(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const rawKeywords = Array.isArray(args.keywords) ? args.keywords : [];
  const keywords = rawKeywords.filter(
    (k: string) => typeof k === 'string' && k.trim().length >= 2
  );

  if (keywords.length === 0) {
    return JSON.stringify({ error: '需要至少一个长度 >= 2 的关键词' });
  }

  const results = await searchByKind('file', keywords, { userId, limit: 15 });

  return JSON.stringify({
    total: results.length,
    files: results.map((r) => ({
      id: r.entityId,
      title: r.title,
      preview: r.preview,
    })),
  });
}

async function executeReadNote(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const [rows] = await db.execute(
    'SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?',
    [args.noteId, userId]
  );
  const note = (rows as any[])[0];

  if (!note) {
    return JSON.stringify({ error: '笔记不存在' });
  }

  return JSON.stringify({
    id: note.id,
    title: note.title,
    content: String(note.content || '').slice(0, 8000),
    created_at: note.created_at,
    updated_at: note.updated_at,
  });
}

async function executeReadTodo(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const [rows] = await db.execute(
    'SELECT id, title, description, priority, status, due_date, created_at FROM todos WHERE id = ? AND user_id = ?',
    [args.todoId, userId]
  );
  const todo = (rows as any[])[0];

  if (!todo) {
    return JSON.stringify({ error: '待办不存在' });
  }

  // 获取关联的子任务
  const [subtasks] = await db.execute(
    'SELECT id, title, done FROM subtasks WHERE todo_id = ?',
    [args.todoId]
  );

  return JSON.stringify({
    id: todo.id,
    title: todo.title,
    description: todo.description || '',
    priority: todo.priority,
    status: todo.status,
    due_date: todo.due_date || null,
    created_at: todo.created_at,
    subtasks: (subtasks as any[]).map((s) => ({
      id: s.id,
      title: s.title,
      done: !!s.done,
    })),
  });
}

async function executeReadFile(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const [rows] = await db.execute(
    'SELECT id, name, type, size, content, url, created_at FROM files WHERE id = ? AND user_id = ?',
    [args.fileId, userId]
  );
  const file = (rows as any[])[0];

  if (!file) {
    return JSON.stringify({ error: '文件不存在' });
  }

  return JSON.stringify({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    content: String(file.content || '').slice(0, 8000),
    url: file.url || null,
    created_at: file.created_at,
  });
}

async function executeListTodos(
  args: Record<string, any>,
  userId: string
): Promise<string> {
  const conditions: string[] = ['user_id = ?'];
  const params: any[] = [userId];

  if (args.status && ['pending', 'in_progress', 'completed'].includes(args.status)) {
    conditions.push('status = ?');
    params.push(args.status);
  }
  if (args.priority && ['low', 'medium', 'high', 'urgent'].includes(args.priority)) {
    conditions.push('priority = ?');
    params.push(args.priority);
  }

  const limit = Math.min(args.limit || 20, 50);

  const [rows] = await db.execute(
    `SELECT id, title, priority, status, due_date FROM todos
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT ?`,
    [...params, limit]
  );

  return JSON.stringify({
    total: (rows as any[]).length,
    todos: (rows as any[]).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date || null,
    })),
  });
}
