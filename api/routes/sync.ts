/**
 * Sync API — 笔记和待办数据同步。
 *
 * 两种使用场景：
 * 1. 云端模式：本地 SQLite ↔ 云端 MySQL（通过 X-Sync-Key 认证）
 * 2. 直接数据同步：客户端直接 POST/PULL 笔记和待办数据
 *
 * Push: 接收笔记/待办数据 → 写入数据库
 * Pull: 从数据库读取笔记/待办 → 返回给客户端
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getSyncOverview, gitPush, gitPull } from '../services/sync.js';
import { executeOnMySQL } from '../config/db.js';
import db from '../config/db.js';

const router = Router();
router.use(authMiddleware);

/** 通过 sync key 解析云端用户 ID */
async function resolveSyncUser(syncKey: string): Promise<string | null> {
  if (!syncKey) return null;
  const hash = crypto.createHash('sha256').update(syncKey).digest('hex');
  try {
    const [rows] = await executeOnMySQL(
      'SELECT user_id FROM quantlife_sync_keys WHERE key_hash = ? LIMIT 1', [hash]
    );
    const r = (rows as any[])[0];
    return r?.user_id || null;
  } catch { return null; }
}

// ============ Status ============

router.get('/status', async (req: AuthRequest, res) => {
  try {
    const syncKey = req.headers['x-sync-key'] as string || '';
    const cloudUserId = await resolveSyncUser(syncKey);
    if (!cloudUserId) { res.status(401).json({ success: false, error: '无效的同步密钥' }); return; }

    const overview = await getSyncOverview(cloudUserId);
    res.json({ success: true, data: overview });
  } catch (error: any) {
    console.error('GET /sync/status error:', error);
    res.status(500).json({ success: false, error: error.message || '获取状态失败' });
  }
});

// ============ Push（接收数据写入）============

router.post('/push', async (req: AuthRequest, res) => {
  try {
    const syncKey = req.headers['x-sync-key'] as string || '';
    const cloudUserId = await resolveSyncUser(syncKey);

    // 场景1：直接数据推送（客户端把笔记和待办数据发过来）
    if (req.body.notes || req.body.todos) {
      if (!cloudUserId) {
        // 没有有效的 sync key，使用当前登录用户
        if (!req.userId) {
          res.status(401).json({ success: false, error: '需要认证或有效的同步密钥' });
          return;
        }
      }
      const userId = cloudUserId || req.userId!;
      const errors: string[] = [];
      let notesPushed = 0;
      let todosPushed = 0;

      const conn = await db.getConnection();
      try {
        // 写入笔记
        if (Array.isArray(req.body.notes)) {
          for (const note of req.body.notes) {
            try {
              const [existing] = await conn.execute(
                'SELECT updated_at FROM notes WHERE id = ? AND user_id = ?',
                [note.id, userId]
              );
              if ((existing as any[])[0]) {
                const localTime = new Date((existing as any[])[0].updated_at || 0).getTime();
                const remoteTime = new Date(note.updatedAt || 0).getTime();
                if (remoteTime <= localTime) continue;
              }
              await conn.execute(
                `INSERT INTO notes (id, title, content, user_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), updated_at = VALUES(updated_at)`,
                [note.id, note.title, note.content || '', userId, note.createdAt, note.updatedAt]
              );
              notesPushed++;
            } catch (e: any) {
              errors.push(`笔记 ${note.title}: ${e.message}`);
            }
          }
        }

        // 写入待办
        if (Array.isArray(req.body.todos)) {
          for (const todo of req.body.todos) {
            try {
              await conn.execute(
                `INSERT INTO todos (id, title, description, priority, status, due_date, is_today_todo, user_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description),
                 priority = VALUES(priority), status = VALUES(status), due_date = VALUES(due_date)`,
                [todo.id, todo.title, todo.description || '', todo.priority || 'medium',
                 todo.status || 'pending', todo.dueDate || null, todo.isTodayTodo ? 1 : 0,
                 userId, todo.createdAt]
              );
              todosPushed++;
            } catch (e: any) {
              errors.push(`待办 ${todo.title}: ${e.message}`);
            }
          }
        }
      } finally {
        conn.release();
      }

      res.json({ success: true, data: { notesPushed, todosPushed, errors } });
      return;
    }

    // 场景2：旧式 MySQL 同步（ids 模式）
    if (!cloudUserId) { res.status(401).json({ success: false, error: '无效的同步密钥' }); return; }
    const ids = req.body?.ids;
    const result = await gitPush(cloudUserId, ids);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('POST /sync/push error:', error);
    res.status(500).json({ success: false, error: error.message || '推送失败' });
  }
});

// ============ Pull（返回数据）============

router.get('/pull', async (req: AuthRequest, res) => {
  try {
    const syncKey = req.headers['x-sync-key'] as string || '';
    const cloudUserId = await resolveSyncUser(syncKey);
    const userId = cloudUserId || req.userId;
    if (!userId) { res.status(401).json({ success: false, error: '需要认证或有效的同步密钥' }); return; }

    // 从数据库读取所有笔记
    const [noteRows] = await db.execute(
      'SELECT id, title, content, created_at AS createdAt, updated_at AS updatedAt FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );

    // 读取笔记标签
    const notes = noteRows as any[];
    const noteIds = notes.map(n => n.id);
    const noteTagsMap: Record<string, string[]> = {};
    if (noteIds.length > 0) {
      const [tagRows] = await db.execute(
        `SELECT note_id, tag FROM note_tags WHERE note_id IN (${noteIds.map(() => '?').join(',')})`,
        noteIds
      );
      for (const row of tagRows as any[]) {
        if (!noteTagsMap[row.note_id]) noteTagsMap[row.note_id] = [];
        noteTagsMap[row.note_id].push(row.tag);
      }
    }
    const notesWithTags = notes.map(n => ({
      ...n,
      tags: noteTagsMap[n.id] || [],
    }));

    // 读取所有待办
    const [todoRows] = await db.execute(
      'SELECT id, title, description, priority, status, due_date AS dueDate, is_today_todo AS isTodayTodo, created_at AS createdAt FROM todos WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // 读取待办标签和子任务
    const todos = todoRows as any[];
    const todoIds = todos.map(t => t.id);
    const todoTagsMap: Record<string, string[]> = {};
    const subtasksMap: Record<string, any[]> = {};

    if (todoIds.length > 0) {
      const [tagRows] = await db.execute(
        `SELECT todo_id, tag FROM todo_tags WHERE todo_id IN (${todoIds.map(() => '?').join(',')})`,
        todoIds
      );
      for (const row of tagRows as any[]) {
        if (!todoTagsMap[row.todo_id]) todoTagsMap[row.todo_id] = [];
        todoTagsMap[row.todo_id].push(row.tag);
      }

      const [subRows] = await db.execute(
        `SELECT id, todo_id, title, done FROM subtasks WHERE todo_id IN (${todoIds.map(() => '?').join(',')})`,
        todoIds
      );
      for (const row of subRows as any[]) {
        if (!subtasksMap[row.todo_id]) subtasksMap[row.todo_id] = [];
        subtasksMap[row.todo_id].push({ id: row.id, title: row.title, done: !!row.done });
      }
    }

    const todosWithExtras = todos.map(t => ({
      ...t,
      tags: todoTagsMap[t.id] || [],
      subtasks: subtasksMap[t.id] || [],
    }));

    res.json({
      success: true,
      data: {
        notes: notesWithTags,
        todos: todosWithExtras,
      },
    });
  } catch (error: any) {
    console.error('GET /sync/pull error:', error);
    res.status(500).json({ success: false, error: error.message || '拉取失败' });
  }
});

// 兼容 POST /pull
router.post('/pull', async (req: AuthRequest, res) => {
  try {
    const syncKey = req.headers['x-sync-key'] as string || '';
    const cloudUserId = await resolveSyncUser(syncKey);
    if (!cloudUserId) { res.status(401).json({ success: false, error: '无效的同步密钥' }); return; }

    const result = await gitPull(cloudUserId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '拉取失败' });
  }
});

export default router;
