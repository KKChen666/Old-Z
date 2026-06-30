import pool from '../config/database.js';

const initDB = async () => {
  const conn = await pool.getConnection();
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

    // 待办-文件关联表
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

    // 笔记-文件关联表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS note_files (
        note_id VARCHAR(64) NOT NULL,
        file_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (note_id, file_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // 笔记-待办关联表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS note_todos (
        note_id VARCHAR(64) NOT NULL,
        todo_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (note_id, todo_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
      )
    `);

    // 待办-笔记关联表
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

    // QuantLife 核心进度数据表
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

    // QuantLife LLM 配置表
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

    // 为现有表添加 user_id 列（忽略已存在的列）
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

    // 为 todos 表添加 is_today_todo 列（兼容旧数据库）
    try {
      await conn.execute('ALTER TABLE todos ADD COLUMN is_today_todo BOOLEAN NOT NULL DEFAULT FALSE');
    } catch (e: any) {
      if (e.errno !== 1060) throw e;
    }

    console.log('Database tables initialized successfully!');
  } catch (error) {
    console.error('Database init error:', error);
    throw error;
  } finally {
    conn.release();
  }
};

export default initDB;
