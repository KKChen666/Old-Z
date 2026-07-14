/**
 * SQLite 数据库 schema 初始化。
 * 将 MySQL schema（init.ts）转换为 SQLite 兼容的 DDL。
 *
 * 基于 sql.js（WASM SQLite），支持 FTS5。
 * Schema 版本通过 PRAGMA user_version 追踪（与 SpringNote 模式一致）。
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import sqliteProvider from '../config/sqlite-provider.js';
import { initSyncSchema } from './sync-schema.js';

// Schema 版本号
export const SCHEMA_VERSION = 2;

// 初始化入口
export async function initSQLite(): Promise<void> {
  await sqliteProvider.initialize();

  const db = sqliteProvider.raw;
  const currentVersion = sqliteProvider.getUserVersion();

  console.log(`[SQLite] Schema version: current=${currentVersion}, latest=${SCHEMA_VERSION}`);

  if (currentVersion === SCHEMA_VERSION) {
    console.log('[SQLite] Schema up to date');
    return;
  }

  createAllTables(db);
  sqliteProvider.setUserVersion(SCHEMA_VERSION);
  console.log('[SQLite] Schema initialized successfully');

  // 初始化同步追踪
  initSyncSchema();
}

function createAllTables(db: SqlJsDatabase): void {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // 文件表
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other'
      CHECK(type IN ('document','image','pdf','link','email','other')),
    size INTEGER NOT NULL DEFAULT 0,
    content TEXT,
    thumbnail TEXT,
    url TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)');

  // 文件标签
  db.run(`CREATE TABLE IF NOT EXISTS file_tags (
    file_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (file_id, tag),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  )`);

  // 待办表
  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK(priority IN ('low','medium','high','urgent')),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','in_progress','completed')),
    due_date TEXT,
    is_today_todo INTEGER NOT NULL DEFAULT 0,
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)');

  // 待办标签
  db.exec(`CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (todo_id, tag),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );`);

  // 子任务
  db.exec(`CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY, todo_id TEXT NOT NULL, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );`);

  // 关联表（只引用已创建的表）
  db.exec(`CREATE TABLE IF NOT EXISTS todo_files (
    todo_id TEXT NOT NULL, file_id TEXT NOT NULL, PRIMARY KEY (todo_id, file_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );`);

  // 笔记表
  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)');

  // 笔记关联（notes 已创建）
  db.exec(`CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (note_id, tag),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS note_files (
    note_id TEXT NOT NULL, file_id TEXT NOT NULL, PRIMARY KEY (note_id, file_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS note_todos (
    note_id TEXT NOT NULL, todo_id TEXT NOT NULL, PRIMARY KEY (note_id, todo_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS todo_notes (
    todo_id TEXT NOT NULL, note_id TEXT NOT NULL, PRIMARY KEY (todo_id, note_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
  );`);

  // 笔记快照
  db.run(`CREATE TABLE IF NOT EXISTS note_snapshots (
    id TEXT PRIMARY KEY, note_id TEXT NOT NULL, user_id TEXT NOT NULL,
    title TEXT NOT NULL, content TEXT NOT NULL, snapshot_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, note_id, snapshot_date),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_ns_user_date ON note_snapshots(user_id, snapshot_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ns_user_ca ON note_snapshots(user_id, created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ns_note_date ON note_snapshots(note_id, created_at)');

  // 日报表
  db.run(`CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, report_date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, report_date)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_dr_user_month ON daily_reports(user_id, report_date)');

  // 聊天消息
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL, user_id TEXT, scope TEXT NOT NULL DEFAULT 'global',
    note_id TEXT, conversation_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_cm_user_id ON chat_messages(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cm_scope_note ON chat_messages(user_id, scope, note_id, timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cm_conv ON chat_messages(user_id, conversation_id, timestamp)');

  // 聊天对话
  db.run(`CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global', note_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_cc_user_updated ON chat_conversations(user_id, updated_at)');

  // 聊天引用
  db.exec(`CREATE TABLE IF NOT EXISTS chat_references (
    message_id TEXT NOT NULL,
    ref_type TEXT NOT NULL CHECK(ref_type IN ('file','note','todo')),
    ref_id TEXT NOT NULL, PRIMARY KEY (message_id, ref_type, ref_id),
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
  );`);

  // 时间轴
  db.run(`CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('file_upload','todo_created','todo_completed','note_created','note_edited','chat','ai_reminder')),
    title TEXT NOT NULL, description TEXT, related_id TEXT, user_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_te_user_id ON timeline_events(user_id)');

  // 同步密钥表
  db.run(`CREATE TABLE IF NOT EXISTS quantlife_sync_keys (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL, label TEXT NOT NULL DEFAULT '默认密钥',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_sync_keys_hash ON quantlife_sync_keys(key_hash)');

  // LLM 预设
  db.run(`CREATE TABLE IF NOT EXISTS quantlife_llm_presets (
    id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai' CHECK(provider IN ('openai','anthropic')),
    base_url TEXT, api_key TEXT, model TEXT,
    balance_url TEXT, balance_method TEXT NOT NULL DEFAULT 'GET' CHECK(balance_method IN ('GET','POST')),
    balance_headers TEXT, balance_body TEXT, balance_path TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_qlp_user_active ON quantlife_llm_presets(user_id, is_active, updated_at)');

  // 旧 LLM 配置
  db.run(`CREATE TABLE IF NOT EXISTS quantlife_llm_config (
    user_id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'openai',
    openai_base_url TEXT, openai_api_key TEXT, openai_model TEXT,
    anthropic_base_url TEXT, anthropic_auth_token TEXT, anthropic_model TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // QuantLife 进度
  db.run(`CREATE TABLE IF NOT EXISTS quantlife_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL, saved_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_ql_saved_at ON quantlife_progress(saved_at)');

  // ===== 全文搜索索引表（使用 bigram + LIKE，兼容 sql.js 无 FTS5） =====
  db.run(`CREATE TABLE IF NOT EXISTS search_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('note','todo','file')),
    entity_id TEXT NOT NULL, user_id TEXT NOT NULL,
    name TEXT NOT NULL, title TEXT NOT NULL, preview TEXT,
    bigrams TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entity_type, entity_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_si_user_type ON search_index(user_id, entity_type)');

  // 自动更新 updated_at 触发器
  createUpdateTrigger(db, 'files', 'updated_at');
  createUpdateTrigger(db, 'notes', 'updated_at');
  createUpdateTrigger(db, 'daily_reports', 'updated_at');
  createUpdateTrigger(db, 'chat_conversations', 'updated_at');
  createUpdateTrigger(db, 'quantlife_llm_presets', 'updated_at');
  createUpdateTrigger(db, 'quantlife_llm_config', 'updated_at');

  console.log('[SQLite] All tables created');
}

function createUpdateTrigger(db: SqlJsDatabase, table: string, column: string): void {
  db.run(`CREATE TRIGGER IF NOT EXISTS trg_${table}_${column}
    AFTER UPDATE ON ${table}
    FOR EACH ROW
    BEGIN
      UPDATE ${table} SET ${column} = datetime('now') WHERE rowid = NEW.rowid;
    END`);
}
