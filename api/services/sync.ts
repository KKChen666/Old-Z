/**
 * Git-like 同步服务。
 *
 * 固定规则：
 *   - 本地 = SQLite（读 local-user 的数据）
 *   - 远端 = MySQL（读写真实用户的数据）
 *
 * push: SQLite → MySQL
 * pull: MySQL → SQLite
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import sqliteProvider from '../config/sqlite-provider.js';
import { MySQLProvider } from '../config/mysql-provider.js';
import { isMySQLAvailable } from '../config/db.js';

// ---- 类型 ----

export type SyncFileStatus =
  | 'local-only' | 'remote-only' | 'synced'
  | 'local-ahead' | 'remote-ahead' | 'conflict';

export interface SyncFileItem {
  id: string; title: string; kind: 'note' | 'todo' | 'file';
  status: SyncFileStatus;
  localUpdatedAt: string | null;
  remoteUpdatedAt: string | null;
}

export interface SyncOverview {
  total: number; localOnly: number; remoteOnly: number;
  synced: number; localAhead: number; remoteAhead: number; conflicted: number;
  items: SyncFileItem[];
}

// ---- 辅助 ----

function queryAll(db: SqlJsDatabase, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  try { stmt.bind(params); const r: any[] = []; while (stmt.step()) r.push(stmt.getAsObject()); return r; }
  finally { stmt.free(); }
}

function getLocalDb(): SqlJsDatabase { return sqliteProvider.raw; }

async function getRemoteDb(): Promise<MySQLProvider | null> {
  if (!isMySQLAvailable()) return null;
  try {
    const p = new MySQLProvider();
    if (await p.healthCheck()) return p;
  } catch {}
  return null;
}

// ---- status ----

export async function getSyncOverview(userId: string): Promise<SyncOverview> {
  await sqliteProvider.initialize();
  const localDb = getLocalDb();
  const remoteDb = await getRemoteDb();

  // 本地来源：只查 local-user 的数据（SQLite）
  const localNotes = queryAll(localDb, "SELECT id, title, updated_at FROM notes WHERE user_id = (SELECT id FROM users WHERE username = 'local-user')");
  const localTodos = queryAll(localDb, "SELECT id, title, created_at FROM todos WHERE user_id = (SELECT id FROM users WHERE username = 'local-user')");

  const items: SyncFileItem[] = [];

  if (remoteDb) {
    // 对比远端
    for (const n of localNotes) {
      const [r] = await remoteDb.execute('SELECT updated_at FROM notes WHERE id = ? AND user_id = ?', [n.id, userId]);
      const remote = (r as any[])[0];
      if (!remote) {
        items.push({ id: n.id, title: n.title, kind: 'note', status: 'local-only', localUpdatedAt: n.updated_at, remoteUpdatedAt: null });
      } else {
        const lt = new Date(n.updated_at || 0).getTime();
        const rt = new Date(remote.updated_at || 0).getTime();
        items.push({ id: n.id, title: n.title, kind: 'note',
          status: lt > rt ? 'local-ahead' : rt > lt ? 'remote-ahead' : 'synced',
          localUpdatedAt: n.updated_at, remoteUpdatedAt: remote.updated_at });
      }
    }

    // 远端独有的
    const [remoteNotes] = await remoteDb.execute('SELECT id, title, updated_at FROM notes WHERE user_id = ?', [userId]);
    const lidSet = new Set(localNotes.map(n => n.id));
    for (const rn of remoteNotes as any[]) {
      if (!lidSet.has(rn.id)) {
        items.push({ id: rn.id, title: rn.title, kind: 'note', status: 'remote-only', localUpdatedAt: null, remoteUpdatedAt: rn.updated_at });
      }
    }

    // Todos
    const [remoteTodos] = await remoteDb.execute('SELECT id, title FROM todos WHERE user_id = ?', [userId]);
    const remoteTodoIds = new Set((remoteTodos as any[]).map(t => t.id));
    for (const t of localTodos) {
      items.push({ id: t.id, title: t.title, kind: 'todo',
        status: remoteTodoIds.has(t.id) ? 'synced' : 'local-only',
        localUpdatedAt: t.created_at, remoteUpdatedAt: remoteTodoIds.has(t.id) ? t.created_at : null });
    }
    for (const rt of remoteTodos as any[]) {
      if (!localTodos.find(t => t.id === rt.id)) {
        items.push({ id: rt.id, title: rt.title, kind: 'todo', status: 'remote-only', localUpdatedAt: null, remoteUpdatedAt: null });
      }
    }

    remoteDb.close();
  } else {
    // 远端不可用：全标记 local-only
    for (const n of localNotes) items.push({ id: n.id, title: n.title, kind: 'note', status: 'local-only', localUpdatedAt: n.updated_at, remoteUpdatedAt: null });
    for (const t of localTodos) items.push({ id: t.id, title: t.title, kind: 'todo', status: 'local-only', localUpdatedAt: t.created_at, remoteUpdatedAt: null });
  }

  return {
    total: items.length,
    localOnly: items.filter(i => i.status === 'local-only').length,
    remoteOnly: items.filter(i => i.status === 'remote-only').length,
    synced: items.filter(i => i.status === 'synced').length,
    localAhead: items.filter(i => i.status === 'local-ahead').length,
    remoteAhead: items.filter(i => i.status === 'remote-ahead').length,
    conflicted: items.filter(i => i.status === 'conflict').length,
    items,
  };
}

// ---- push: SQLite → MySQL ----

export async function gitPush(userId: string, ids?: string[]): Promise<{ pushed: number; errors: string[] }> {
  const errors: string[] = [];
  const remoteDb = await getRemoteDb();
  if (!remoteDb) return { pushed: 0, errors: ['云端不可用'] };

  await sqliteProvider.initialize();
  const localDb = getLocalDb();

  let notesQuery = "SELECT * FROM notes WHERE user_id = (SELECT id FROM users WHERE username = 'local-user')";
  if (ids && ids.length > 0) {
    notesQuery += ` AND id IN (${ids.map(() => '?').join(',')})`;
  }
  const localNotes = queryAll(localDb, notesQuery, ids || []);
  let pushed = 0;

  for (const n of localNotes) {
    try {
      const [existing] = await remoteDb.execute('SELECT updated_at FROM notes WHERE id = ? AND user_id = ?', [n.id, userId]);
      if ((existing as any[])[0]) {
        const rt = new Date((existing as any[])[0].updated_at || 0).getTime();
        if (rt >= new Date(n.updated_at || 0).getTime()) {
          errors.push(`${n.title}: 云端版本更新，跳过`);
          continue;
        }
      }
      await remoteDb.execute(
        'INSERT INTO notes (id, title, content, user_id, created_at, updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),content=VALUES(content),updated_at=VALUES(updated_at)',
        [n.id, n.title, n.content, userId, n.created_at, n.updated_at]);
      pushed++;
    } catch (e: any) { errors.push(`${n.title}: ${e?.message}`); }
  }

  const localTodos = queryAll(localDb, "SELECT * FROM todos WHERE user_id = (SELECT id FROM users WHERE username = 'local-user')");
  for (const t of localTodos) {
    try {
      await remoteDb.execute(
        'INSERT INTO todos (id, title, description, priority, status, due_date, user_id, created_at) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),priority=VALUES(priority),status=VALUES(status)',
        [t.id, t.title, t.description, t.priority, t.status, t.due_date, userId, t.created_at]);
      pushed++;
    } catch (e: any) { errors.push(`${t.title}: ${e?.message}`); }
  }

  await remoteDb.close();
  return { pushed, errors };
}

// ---- pull: MySQL → SQLite ----

export async function gitPull(userId: string): Promise<{ pulled: number; errors: string[] }> {
  const errors: string[] = [];
  const remoteDb = await getRemoteDb();
  if (!remoteDb) return { pulled: 0, errors: ['云端不可用'] };

  await sqliteProvider.initialize();
  const localDb = getLocalDb();
  let pulled = 0;

  const [remoteNotes] = await remoteDb.execute('SELECT * FROM notes WHERE user_id = ?', [userId]);
  for (const rn of remoteNotes as any[]) {
    try {
      const local = queryAll(localDb, 'SELECT id, updated_at FROM notes WHERE id = ?', [rn.id])[0];
      if (!local) {
        localDb.run('INSERT OR REPLACE INTO notes (id, title, content, user_id, created_at, updated_at) VALUES (?,?,?,?,?,?)',
          [rn.id, rn.title, rn.content, userId, rn.created_at, rn.updated_at]);
        pulled++;
      } else if (new Date(rn.updated_at).getTime() > new Date((local as any).updated_at || 0).getTime()) {
        localDb.run('UPDATE notes SET title=?,content=?,updated_at=? WHERE id=?',
          [rn.title, rn.content, rn.updated_at, rn.id]);
        pulled++;
      }
    } catch (e: any) { errors.push(`${rn.title}: ${e?.message}`); }
  }

  sqliteProvider.autoSave();
  await remoteDb.close();
  return { pulled, errors };
}
