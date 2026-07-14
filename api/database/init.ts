/**
 * 数据库初始化入口。
 *
 * 根据 DB_PROVIDER 环境变量选择初始化策略：
 *   - "mysql"  → 使用 MySQL（保持旧逻辑兼容）
 *   - "sqlite" → 使用 SQLite（新逻辑）
 *   - 默认 → sqlite
 */

import { MySQLProvider } from '../config/mysql-provider.js';
import { initSQLite } from './sqlite-schema.js';

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Shanghai';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function appDateString(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = DATE_FORMATTER.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function ignoreMysqlError(error: any, errno: number) {
  if (error.errno !== errno) throw error;
}

async function initMySQL(): Promise<void> {
  const mysqlProvider = new MySQLProvider();
  const conn = await mysqlProvider.getConnection();
  try {
    // 文件表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS files (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        type ENUM('document','image','pdf','link','email','other') NOT NULL DEFAULT 'other',
        size BIGINT NOT NULL DEFAULT 0,
        content TEXT,
        thumbnail VARCHAR(500),
        url VARCHAR(500),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 文件标签表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS file_tags (
        file_id VARCHAR(64) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        PRIMARY KEY (file_id, tag),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // 待办表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
        status ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
        due_date DATE,
        is_today_todo BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 待办标签表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS todo_tags (
        todo_id VARCHAR(64) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        PRIMARY KEY (todo_id, tag),
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
      )
    `);

    // 子任务表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id VARCHAR(64) PRIMARY KEY,
        todo_id VARCHAR(64) NOT NULL,
        title VARCHAR(500) NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
      )
    `);

    // 待办-文件关联
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS todo_files (
        todo_id VARCHAR(64) NOT NULL,
        file_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (todo_id, file_id),
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // 笔记表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 笔记标签表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id VARCHAR(64) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        PRIMARY KEY (note_id, tag),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      )
    `);

    // 笔记-文件关联
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS note_files (
        note_id VARCHAR(64) NOT NULL,
        file_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (note_id, file_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // 笔记-待办关联
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS note_todos (
        note_id VARCHAR(64) NOT NULL,
        todo_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (note_id, todo_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
      )
    `);

    // 笔记快照表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS note_snapshots (
        id VARCHAR(64) PRIMARY KEY,
        note_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(500) NOT NULL,
        content MEDIUMTEXT NOT NULL,
        snapshot_date DATE NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_note_snapshots_daily (user_id, note_id, snapshot_date),
        INDEX idx_note_snapshots_user_snapshot_date (user_id, snapshot_date),
        INDEX idx_note_snapshots_user_date (user_id, created_at),
        INDEX idx_note_snapshots_note_date (note_id, created_at),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      )
    `);

    // 兼容旧快照表结构
    try {
      await conn.execute('ALTER TABLE note_snapshots ADD COLUMN snapshot_date DATE NULL AFTER content');
    } catch (e: any) {
      ignoreMysqlError(e, 1060);
    }
    await conn.execute('UPDATE note_snapshots SET snapshot_date = DATE(created_at) WHERE snapshot_date IS NULL');
    await conn.execute(`
      DELETE ns1 FROM note_snapshots ns1
      JOIN note_snapshots ns2
       ON ns1.user_id = ns2.user_id
       AND ns1.note_id = ns2.note_id
       AND ns1.snapshot_date = ns2.snapshot_date
       AND (ns1.created_at < ns2.created_at OR (ns1.created_at = ns2.created_at AND ns1.id < ns2.id))
    `);
    await conn.execute('ALTER TABLE note_snapshots MODIFY snapshot_date DATE NOT NULL');
    try {
      await conn.execute('CREATE UNIQUE INDEX uk_note_snapshots_daily ON note_snapshots (user_id, note_id, snapshot_date)');
    } catch (e: any) {
      ignoreMysqlError(e, 1061);
    }
    try {
      await conn.execute('CREATE INDEX idx_note_snapshots_user_snapshot_date ON note_snapshots (user_id, snapshot_date)');
    } catch (e: any) {
      ignoreMysqlError(e, 1061);
    }
    await conn.execute('DELETE FROM note_snapshots WHERE snapshot_date < ?', [appDateString(-6)]);

    // 日报表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        report_date DATE NOT NULL,
        content MEDIUMTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_daily_reports_user_date (user_id, report_date),
        INDEX idx_daily_reports_user_month (user_id, report_date)
      )
    `);

    // 待办-笔记关联
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS todo_notes (
        todo_id VARCHAR(64) NOT NULL,
        note_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (todo_id, note_id),
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      )
    `);

    // 聊天消息表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        role ENUM('user','assistant') NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(200) NOT NULL,
        scope VARCHAR(20) NOT NULL DEFAULT 'global',
        note_id VARCHAR(64),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chat_conversations_user_updated (user_id, updated_at)
      )
    `);

    // 聊天引用表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS chat_references (
        message_id VARCHAR(64) NOT NULL,
        ref_type ENUM('file','note','todo') NOT NULL,
        ref_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (message_id, ref_type, ref_id),
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
      )
    `);

    // 时间轴事件表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id VARCHAR(64) PRIMARY KEY,
        type ENUM('file_upload','todo_created','todo_completed','note_created','note_edited','chat','ai_reminder') NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        related_id VARCHAR(64),
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 用户表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(200),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // QuantLife 表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS quantlife_progress (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(64) NOT NULL,
        payload JSON NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_ql_user (user_id),
        INDEX idx_ql_saved_at (saved_at)
      )
    `);

    // 同步密钥表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS quantlife_sync_keys (
        id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        label VARCHAR(100) NOT NULL DEFAULT '默认密钥',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, user_id),
        INDEX idx_sync_keys_hash (key_hash)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS quantlife_llm_config (
        user_id VARCHAR(64) PRIMARY KEY,
        provider VARCHAR(16) NOT NULL DEFAULT 'openai',
        openai_base_url VARCHAR(512),
        openai_api_key VARCHAR(512),
        openai_model VARCHAR(128),
        anthropic_base_url VARCHAR(512),
        anthropic_auth_token VARCHAR(512),
        anthropic_model VARCHAR(128),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS quantlife_llm_presets (
        id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        provider VARCHAR(16) NOT NULL DEFAULT 'openai',
        base_url VARCHAR(512),
        api_key VARCHAR(2048),
        model VARCHAR(128),
        balance_url VARCHAR(1024),
        balance_method VARCHAR(8) NOT NULL DEFAULT 'GET',
        balance_headers TEXT,
        balance_body TEXT,
        balance_path VARCHAR(200),
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id, user_id),
        INDEX idx_llm_presets_user_active (user_id, is_active, updated_at)
      )
    `);

    // 为现有表添加 user_id 列
    const tablesWithUserId = ['files', 'todos', 'notes', 'chat_messages', 'timeline_events'];
    for (const table of tablesWithUserId) {
      try {
        await conn.execute(`ALTER TABLE ${table} ADD COLUMN user_id VARCHAR(64)`);
      } catch (e: any) {
        if (e.errno !== 1060) throw e;
      }
      try {
        await conn.execute(`CREATE INDEX idx_${table}_user_id ON ${table} (user_id)`);
      } catch (e: any) {
        if (e.errno !== 1061) throw e;
      }
    }

    // 兼容旧表结构
    try {
      await conn.execute('ALTER TABLE todos ADD COLUMN is_today_todo BOOLEAN NOT NULL DEFAULT FALSE');
    } catch (e: any) {
      if (e.errno !== 1060) throw e;
    }

    try {
      await conn.execute("ALTER TABLE chat_messages ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'global'");
    } catch (e: any) {
      if (e.errno !== 1060) throw e;
    }
    try {
      await conn.execute('ALTER TABLE chat_messages ADD COLUMN note_id VARCHAR(64) NULL');
    } catch (e: any) {
      if (e.errno !== 1060) throw e;
    }
    try {
      await conn.execute('ALTER TABLE chat_messages ADD COLUMN conversation_id VARCHAR(64) NULL');
    } catch (e: any) {
      if (e.errno !== 1060) throw e;
    }
    try {
      await conn.execute('CREATE INDEX idx_chat_messages_scope_note ON chat_messages (user_id, scope, note_id, timestamp)');
    } catch (e: any) {
      if (e.errno !== 1061) throw e;
    }
    try {
      await conn.execute('CREATE INDEX idx_chat_messages_conversation ON chat_messages (user_id, conversation_id, timestamp)');
    } catch (e: any) {
      if (e.errno !== 1061) throw e;
    }

    console.log('[MySQL] Database tables initialized successfully!');
  } catch (error) {
    console.error('[MySQL] Database init error:', error);
    throw error;
  } finally {
    conn.release();
  }
}

const initDB = async () => {
  const mode = (process.env.DB_PROVIDER || '').toLowerCase();

  if (mode === 'sqlite') {
    console.log('[DB] Initializing SQLite database...');
    await initSQLite();
  } else if (mode === 'mysql' || process.env.DB_HOST) {
    // MySQL 显式设置或有凭据 → 初始化 MySQL；SQLite 作为 schema 备份也初始化
    console.log('[DB] Initializing MySQL database...');
    await initMySQL().catch((e) => console.warn('[DB] MySQL init failed (may be unavailable), continuing with SQLite:', e?.message || e));
    if (mode !== 'mysql') {
      console.log('[DB] Initializing SQLite database (as fallback)...');
      await initSQLite();
    }
  } else {
    console.log('[DB] Initializing SQLite database...');
    await initSQLite();
  }

  console.log('[DB] Database initialization complete');
};

export default initDB;
