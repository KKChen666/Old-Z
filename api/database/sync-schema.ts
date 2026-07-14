/**
 * 同步追踪表 schema。
 * 用于记录 SQLite 本地变更，在恢复在线时同步到 MySQL。
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import sqliteProvider from '../config/sqlite-provider.js';

export function initSyncSchema(): void {
  const db = sqliteProvider.raw;

  // 同步日志表
  db.run(`CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('insert','update','delete')),
    old_data TEXT, new_data TEXT,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_sync_log_synced ON sync_log(synced, created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sync_log_table ON sync_log(table_name, record_id)');

  // 同步状态表
  db.run(`CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    last_push_millis INTEGER NOT NULL DEFAULT 0,
    last_pull_millis INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // 确保状态表有初始行
  db.run(`INSERT OR IGNORE INTO sync_state (id, last_push_millis, last_pull_millis, pending_count, updated_at)
    VALUES (1, 0, 0, 0, datetime('now'))`);

  // 为业务表创建同步触发器
  const columns: Record<string, string[]> = {
    notes: ['id', 'title', 'content', 'user_id', 'updated_at'],
    todos: ['id', 'title', 'description', 'priority', 'status', 'due_date', 'user_id'],
    files: ['id', 'name', 'type', 'size', 'content', 'url', 'user_id'],
    note_snapshots: ['id', 'note_id', 'user_id', 'title', 'content', 'snapshot_date'],
    daily_reports: ['id', 'user_id', 'report_date', 'content'],
    chat_messages: ['id', 'role', 'content', 'user_id', 'scope', 'note_id', 'conversation_id', 'timestamp'],
    chat_conversations: ['id', 'user_id', 'title', 'scope', 'note_id'],
  };

  for (const [table, cols] of Object.entries(columns)) {
    createSyncTriggers(db, table, cols);
  }

  console.log('[Sync] Sync schema initialized');
}

function createSyncTriggers(
  db: SqlJsDatabase,
  table: string,
  columns: string[]
): void {
  const jsonCols = columns.map((c) => `'${c}', NEW.${c}`).join(', ');
  const oldJsonCols = columns.map((c) => `'${c}', OLD.${c}`).join(', ');

  // INSERT 触发器
  db.run(`CREATE TRIGGER IF NOT EXISTS trg_sync_${table}_insert
    AFTER INSERT ON ${table}
    FOR EACH ROW
    BEGIN
      INSERT INTO sync_log (table_name, record_id, operation, new_data)
      VALUES ('${table}', NEW.id, 'insert', json_object(${jsonCols}));
      UPDATE sync_state SET pending_count = pending_count + 1, updated_at = datetime('now') WHERE id = 1;
    END`);

  // UPDATE 触发器
  db.run(`CREATE TRIGGER IF NOT EXISTS trg_sync_${table}_update
    AFTER UPDATE ON ${table}
    FOR EACH ROW
    BEGIN
      INSERT INTO sync_log (table_name, record_id, operation, old_data, new_data)
      VALUES ('${table}', NEW.id, 'update', json_object(${oldJsonCols}), json_object(${jsonCols}));
      UPDATE sync_state SET pending_count = pending_count + 1, updated_at = datetime('now') WHERE id = 1;
    END`);

  // DELETE 触发器
  db.run(`CREATE TRIGGER IF NOT EXISTS trg_sync_${table}_delete
    AFTER DELETE ON ${table}
    FOR EACH ROW
    BEGIN
      INSERT INTO sync_log (table_name, record_id, operation, old_data)
      VALUES ('${table}', OLD.id, 'delete', json_object(${oldJsonCols}));
      UPDATE sync_state SET pending_count = pending_count + 1, updated_at = datetime('now') WHERE id = 1;
    END`);
}
