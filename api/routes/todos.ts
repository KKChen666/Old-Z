import { Router, type Request, type Response } from 'express';
import pool from '../db.js';

const router = Router();

// 获取所有待办
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [todos] = await pool.execute('SELECT * FROM todos ORDER BY created_at DESC');
    const [tags] = await pool.execute('SELECT * FROM todo_tags');
    const [subtasks] = await pool.execute('SELECT * FROM subtasks');
    const [todoFiles] = await pool.execute('SELECT * FROM todo_files');
    const [todoNotes] = await pool.execute('SELECT * FROM todo_notes');

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
      createdAt: t.created_at,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch todos' });
  }
});

// 创建待办
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, title, description, priority, status, dueDate, tags, subtasks, fileIds } = req.body;
    const now = new Date();

    await pool.execute(
      'INSERT INTO todos (id, title, description, priority, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, title, description || null, priority || 'medium', status || 'pending', dueDate || null, now]
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

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('POST /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to create todo' });
  }
});

// 更新待办
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, status, dueDate } = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (dueDate !== undefined) { fields.push('due_date = ?'); values.push(dueDate); }

    if (fields.length > 0) {
      values.push(req.params.id);
      await pool.execute(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to update todo' });
  }
});

// 切换子任务状态
router.patch('/:todoId/subtasks/:subtaskId', async (req: Request, res: Response) => {
  try {
    await pool.execute('UPDATE subtasks SET done = NOT done WHERE id = ? AND todo_id = ?', [req.params.subtaskId, req.params.todoId]);
    res.json({ success: true });
  } catch (error) {
    console.error('PATCH subtask error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle subtask' });
  }
});

// 删除待办
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.execute('DELETE FROM todos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /todos error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete todo' });
  }
});

export default router;
