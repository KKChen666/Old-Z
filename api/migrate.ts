import pool from './db.js';

const migrate = async () => {
  const conn = await pool.getConnection();
  try {
    // 给 todos 表添加 is_today_todo 字段
    try {
      await conn.execute(`ALTER TABLE todos ADD COLUMN is_today_todo BOOLEAN NOT NULL DEFAULT FALSE AFTER due_date`);
      console.log('Added is_today_todo column to todos table');
    } catch (e: any) {
      // 字段已存在则忽略
      if (!e.message?.includes('Duplicate column')) {
        throw e;
      }
      console.log('is_today_todo column already exists');
    }

    console.log('Migration completed!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    conn.release();
  }
};

export default migrate;
