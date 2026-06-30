import { Router, type Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取所有待办
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [todos] = await pool.execute('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', [req.userId!]);
    const [tags] = await pool.execute('SELECT tt.* FROM todo_tags tt JOIN todos t ON tt.todo_id = t.id WHERE t.user_id = ?', [req.userId!]);
    const [subtasks] = await pool.execute('SELECT s.* FROM subtasks s JOIN todos t ON s.todo_id = t.id WHERE t.user_id = ?', [req.userId!]);
    const [todoFiles] = await pool.execute('SELECT tf.* FROM todo_files tf JOIN todos t ON tf.todo_id = t.id WHERE t.user_id = ?', [req.userId!]);
    const [todoNotes] = await pool.execute('SELECT tn.* FROM todo_notes tn JOIN todos t ON tn.todo_id = t.id WHERE t.user_id = ?', [req.userId!]);

    const tagMap = new Map<string, string[]>();
    (tags as any[]).forEach((t) => {
      if (!tagMap.has(t.todo_id)) tagMap.set(t.todo_id, []);
      tagMap.get(t.todo_id)!.push(t.tag);
    });

    const subtaskMap = new Map<string, any[]>();
    (subtasks as any[]).forEach((s) => {
      if (!subtaskMap.has(s.todo_id)) subtaskMap.set(s.todo_id, []);
      subtaskMap.get(s.todo_id)!.push({ id: s.id, title: s.title, done: !!s.done });
    });

    const fileMap = new Map<string, string[]>();
    (todoFiles as any[]).forEach((f) => {
      if (!fileMap.has(f.todo_id)) fileMap.set(f.todo_id, []);
      fileMap.get(f.todo_id)!.push(f.file_id);
    });

    const noteMap = new Map<string, string[]>();
    (todoNotes as any[]).forEach((n) => {
      if (!noteMap.has(n.todo_id)) noteMap.set(n.todo_id, []);
      noteMap.get(n.todo_id)!.push(n.note_id);
    });

    const result = (todos as any[]).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      dueDate: t.due_date,
      tags: tagMap.get(t.id) || [],
      fileIds: fileMap.get(t.id) || [],
      noteIds: noteMap.get(t.id) || [],
      subtasks: subtaskMap.get(t.id) || [],
      isTodayTodo: !!t.is_today_todo,
      createdAt: t.created_at,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch todos' });
  }
});

// 创建待办
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['pending', 'in_progress', 'completed'];

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { id, title, description, priority, status, dueDate, isTodayTodo, tags, subtasks, fileIds } = req.body;

    if (!title || typeof title !== 'string' || title.length > 500) {
      res.status(400).json({ success: false, error: '标题无效或过长' });
      return;
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ success: false, error: '无效的优先级' });
      return;
    }
    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: '无效的状态' });
      return;
    }

    const now = new Date();

    await pool.execute(
      'INSERT INTO todos (id, title, description, priority, status, due_date, is_today_todo, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description || null, priority || 'medium', status || 'pending', dueDate || null, isTodayTodo || false, now, req.userId!]
    );

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await pool.execute('INSERT IGNORE INTO todo_tags (todo_id, tag) VALUES (?, ?)', [id, tag]);
      }
    }

    if (fileIds && fileIds.length > 0) {
      for (const fileId of fileIds) {
        await pool.execute('INSERT IGNORE INTO todo_files (todo_id, file_id) VALUES (?, ?)', [id, fileId]);
      }
    }

    if (subtasks && subtasks.length > 0) {
      for (const sub of subtasks) {
        await pool.execute('INSERT INTO subtasks (id, todo_id, title, done) VALUES (?, ?, ?, ?)', [sub.id, id, sub.title, sub.done || false]);
      }
    }

    const { noteIds } = req.body;
    if (noteIds && noteIds.length > 0) {
      for (const noteId of noteIds) {
        await pool.execute('INSERT IGNORE INTO note_todos (note_id, todo_id) VALUES (?, ?)', [noteId, id]);
        await pool.execute('INSERT IGNORE INTO todo_notes (todo_id, note_id) VALUES (?, ?)', [id, noteId]);
      }
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('POST /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to create todo' });
  }
});

// 更新待办
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, status, dueDate, isTodayTodo } = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) { res.status(400).json({ success: false, error: '无效的优先级' }); return; }
      fields.push('priority = ?'); values.push(priority);
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) { res.status(400).json({ success: false, error: '无效的状态' }); return; }
      fields.push('status = ?'); values.push(status);
    }
    if (dueDate !== undefined) { fields.push('due_date = ?'); values.push(dueDate); }
    if (isTodayTodo !== undefined) { fields.push('is_today_todo = ?'); values.push(isTodayTodo); }

    if (fields.length > 0) {
      values.push(req.params.id, req.userId!);
      await pool.execute(`UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to update todo' });
  }
});

// 切换子任务状态
router.patch('/:todoId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
  try {
    await pool.execute(
      'UPDATE subtasks s JOIN todos t ON s.todo_id = t.id SET s.done = NOT s.done WHERE s.id = ? AND s.todo_id = ? AND t.user_id = ?',
      [req.params.subtaskId, req.params.todoId, req.userId!]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('PATCH subtask error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle subtask' });
  }
});

// 删除待办
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [result] = await pool.execute('DELETE FROM todos WHERE id = ? AND user_id = ?', [req.params.id, req.userId!]) as any;
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: '待办不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete todo' });
  }
});

export default router;
