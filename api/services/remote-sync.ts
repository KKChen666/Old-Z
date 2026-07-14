/**
 * 远程同步服务。
 *
 * 本地 SQLite ↔ 远端 Old Z 服务器（通过 HTTP API）。
 *
 * Push: 读取本地 SQLite 中的笔记和待办 → POST 到远端 /api/sync/push
 * Pull: GET 远端 /api/sync/pull → 写入本地 SQLite
 *
 * 本地模式用户通过此服务与云端或其他 Old Z 实例同步数据。
 */

import sqliteProvider from '../config/sqlite-provider.js';
import type { Database as SqlJsDatabase } from 'sql.js';

// ---- 辅助 ----

function queryAll(db: SqlJsDatabase, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const r: any[] = [];
    while (stmt.step()) r.push(stmt.getAsObject());
    return r;
  } finally {
    stmt.free();
  }
}

// ---- 从本地 SQLite 读取数据 ----

async function getLocalData() {
  await sqliteProvider.initialize();
  const db = sqliteProvider.raw;

  const notes = queryAll(db, "SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = (SELECT id FROM users WHERE username = 'local-user')");
  const todos = queryAll(db, "SELECT id, title, description, priority, status, due_date, is_today_todo, created_at FROM todos WHERE user_id = (SELECT id FROM users WHERE username = 'local-user')");

  // 获取笔记标签
  const noteIds = notes.map(n => n.id);
  const noteTagsMap: Record<string, string[]> = {};
  if (noteIds.length > 0) {
    const placeholders = noteIds.map(() => '?').join(',');
    const tagRows = queryAll(db, `SELECT note_id, tag FROM note_tags WHERE note_id IN (${placeholders})`, noteIds);
    for (const row of tagRows) {
      if (!noteTagsMap[row.note_id]) noteTagsMap[row.note_id] = [];
      noteTagsMap[row.note_id].push(row.tag);
    }
  }

  // 获取待办标签
  const todoIds = todos.map(t => t.id);
  const todoTagsMap: Record<string, string[]> = {};
  if (todoIds.length > 0) {
    const placeholders = todoIds.map(() => '?').join(',');
    const tagRows = queryAll(db, `SELECT todo_id, tag FROM todo_tags WHERE todo_id IN (${placeholders})`, todoIds);
    for (const row of tagRows) {
      if (!todoTagsMap[row.todo_id]) todoTagsMap[row.todo_id] = [];
      todoTagsMap[row.todo_id].push(row.tag);
    }
  }

  // 获取子任务
  const subtasksMap: Record<string, any[]> = {};
  if (todoIds.length > 0) {
    const placeholders = todoIds.map(() => '?').join(',');
    const subRows = queryAll(db, `SELECT id, todo_id, title, done FROM subtasks WHERE todo_id IN (${placeholders})`, todoIds);
    for (const row of subRows) {
      if (!subtasksMap[row.todo_id]) subtasksMap[row.todo_id] = [];
      subtasksMap[row.todo_id].push({ id: row.id, title: row.title, done: !!row.done });
    }
  }

  return {
    notes: notes.map(n => ({
      ...n,
      tags: noteTagsMap[n.id] || [],
    })),
    todos: todos.map(t => ({
      ...t,
      tags: todoTagsMap[t.id] || [],
      subtasks: subtasksMap[t.id] || [],
    })),
  };
}

// ---- 写入本地 SQLite ----

async function saveLocalData(data: { notes: any[]; todos: any[] }) {
  await sqliteProvider.initialize();
  const db = sqliteProvider.raw;

  // 获取 local-user 的 ID
  const [userRow] = queryAll(db, "SELECT id FROM users WHERE username = 'local-user'");
  const userId = userRow?.id || 'local-user';

  // 确保 local-user 存在
  if (!userRow) {
    db.run("INSERT OR IGNORE INTO users (id, username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
      ['local-user', 'local-user', '', '本地模式', new Date().toISOString()]);
  }

  for (const note of data.notes) {
    const existing = queryAll(db, 'SELECT id, updated_at FROM notes WHERE id = ?', [note.id])[0];
    if (!existing) {
      // 新笔记
      db.run(
        'INSERT OR REPLACE INTO notes (id, title, content, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [note.id, note.title, note.content || '', userId, note.created_at, note.updated_at]
      );
    } else {
      // 对比时间戳，只更新更新的版本
      const localTime = new Date(existing.updated_at || 0).getTime();
      const remoteTime = new Date(note.updated_at || 0).getTime();
      if (remoteTime > localTime) {
        db.run(
          'UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
          [note.title, note.content || '', note.updated_at, note.id]
        );
      }
    }
    // 同步标签
    if (note.tags && note.tags.length > 0) {
      db.run('DELETE FROM note_tags WHERE note_id = ?', [note.id]);
      for (const tag of note.tags) {
        db.run('INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)', [note.id, tag]);
      }
    }
  }

  for (const todo of data.todos) {
    const existing = queryAll(db, 'SELECT id FROM todos WHERE id = ?', [todo.id])[0];
    if (!existing) {
      db.run(
        'INSERT OR REPLACE INTO todos (id, title, description, priority, status, due_date, is_today_todo, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [todo.id, todo.title, todo.description || '', todo.priority || 'medium', todo.status || 'pending', todo.due_date || null, todo.is_today_todo ? 1 : 0, userId, todo.created_at]
      );
    } else {
      db.run(
        'UPDATE todos SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, is_today_todo = ? WHERE id = ?',
        [todo.title, todo.description || '', todo.priority || 'medium', todo.status || 'pending', todo.due_date || null, todo.is_today_todo ? 1 : 0, todo.id]
      );
    }
    // 同步标签 & 子任务
    if (todo.tags && todo.tags.length > 0) {
      db.run('DELETE FROM todo_tags WHERE todo_id = ?', [todo.id]);
      for (const tag of todo.tags) {
        db.run('INSERT OR IGNORE INTO todo_tags (todo_id, tag) VALUES (?, ?)', [todo.id, tag]);
      }
    }
    if (todo.subtasks && todo.subtasks.length > 0) {
      db.run('DELETE FROM subtasks WHERE todo_id = ?', [todo.id]);
      for (const sub of todo.subtasks) {
        db.run('INSERT OR REPLACE INTO subtasks (id, todo_id, title, done) VALUES (?, ?, ?, ?)',
          [sub.id, todo.id, sub.title, sub.done ? 1 : 0]);
      }
    }
  }

  sqliteProvider.autoSave();
}

// ---- HTTP 调用远端 ----

interface RemoteConfig {
  name: string;
  url: string;
  key: string;
}

async function callRemote(
  config: RemoteConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: any
): Promise<any> {
  const baseUrl = config.url.replace(/\/+$/, '');
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Sync-Key': config.key,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const err = JSON.parse(text);
      msg = err.error || text;
    } catch {}
    throw new Error(`${res.status}: ${msg}`);
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.error || '远端返回错误');
  return data.data;
}

// ---- Push: 本地 → 远端 ----

export async function pushToRemote(config: RemoteConfig): Promise<{
  notesPushed: number;
  todosPushed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const localData = await getLocalData();

  const notesPayload = localData.notes.map(n => ({
    id: n.id,
    title: n.title,
    content: n.content,
    tags: n.tags,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  const todosPayload = localData.todos.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueDate: t.due_date,
    tags: t.tags,
    subtasks: t.subtasks,
    createdAt: t.created_at,
  }));

  try {
    const result = await callRemote(config, 'POST', '/api/sync/push', {
      notes: notesPayload,
      todos: todosPayload,
    });
    return {
      notesPushed: result.notesPushed ?? notesPayload.length,
      todosPushed: result.todosPushed ?? todosPayload.length,
      errors: result.errors || [],
    };
  } catch (e: any) {
    errors.push(e.message || '推送失败');
    return { notesPushed: 0, todosPushed: 0, errors };
  }
}

// ---- Pull: 远端 → 本地 ----

export async function pullFromRemote(config: RemoteConfig): Promise<{
  notesPulled: number;
  todosPulled: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const result = await callRemote(config, 'GET', '/api/sync/pull');

    const remoteNotes = (result.notes || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content || '',
      tags: n.tags || [],
      created_at: n.createdAt || n.created_at,
      updated_at: n.updatedAt || n.updated_at,
    }));

    const remoteTodos = (result.todos || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
      status: t.status || 'pending',
      due_date: t.dueDate || t.due_date || null,
      is_today_todo: t.isTodayTodo ? 1 : 0,
      tags: t.tags || [],
      subtasks: (t.subtasks || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        done: !!s.done,
      })),
      created_at: t.createdAt || t.created_at,
    }));

    await saveLocalData({ notes: remoteNotes, todos: remoteTodos });

    return {
      notesPulled: remoteNotes.length,
      todosPulled: remoteTodos.length,
      errors,
    };
  } catch (e: any) {
    errors.push(e.message || '拉取失败');
    return { notesPulled: 0, todosPulled: 0, errors };
  }
}

// ---- Status: 比较本地和远端 ----

export async function getRemoteSyncStatus(config: RemoteConfig): Promise<{
  local: { notes: number; todos: number };
  remote: { notes: number; todos: number } | null;
  error?: string;
}> {
  const localData = await getLocalData();
  const local = {
    notes: localData.notes.length,
    todos: localData.todos.length,
  };

  try {
    const remoteData = await callRemote(config, 'GET', '/api/sync/pull');
    const remote = {
      notes: (remoteData.notes || []).length,
      todos: (remoteData.todos || []).length,
    };
    return { local, remote };
  } catch (e: any) {
    return { local, remote: null, error: e.message || '无法连接远端' };
  }
}

// ---- Test Connection ----

export async function testConnection(config: RemoteConfig): Promise<{
  ok: boolean;
  serverInfo?: string;
  error?: string;
}> {
  try {
    const baseUrl = config.url.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'X-Sync-Key': config.key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `服务器返回 ${res.status}` };
    }
    const data = await res.json();
    return {
      ok: true,
      serverInfo: data?.dbMode === 'cloud' ? '云端服务器' : data?.message || '连接正常',
    };
  } catch (e: any) {
    return { ok: false, error: e.message || '无法连接' };
  }
}
