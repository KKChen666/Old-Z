import { Router, type Request, type Response } from 'express';
import pool from '../db.js';

const router = Router();

// 获取所有笔记
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [notes] = await pool.execute('SELECT * FROM notes ORDER BY updated_at DESC');
    const [tags] = await pool.execute('SELECT * FROM note_tags');
    const [noteFiles] = await pool.execute('SELECT * FROM note_files');
    const [noteTodos] = await pool.execute('SELECT * FROM note_todos');

    const tagMap = new Map<string, string[]>();
    (tags as any[]).forEach((t) => {
      if (!tagMap.has(t.note_id)) tagMap.set(t.note_id, []);
      tagMap.get(t.note_id)!.push(t.tag);
    });

    const fileMap = new Map<string, string[]>();
    (noteFiles as any[]).forEach((f) => {
      if (!fileMap.has(f.note_id)) fileMap.set(f.note_id, []);
      fileMap.get(f.note_id)!.push(f.file_id);
    });

    const todoMap = new Map<string, string[]>();
    (noteTodos as any[]).forEach((t) => {
      if (!todoMap.has(t.note_id)) todoMap.set(t.note_id, []);
      todoMap.get(t.note_id)!.push(t.todo_id);
    });

    const result = (notes as any[]).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      tags: tagMap.get(n.id) || [],
      linkedFileIds: fileMap.get(n.id) || [],
      linkedTodoIds: todoMap.get(n.id) || [],
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

// 创建笔记
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, title, content, tags } = req.body;
    const now = new Date();

    await pool.execute(
      'INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, title, content || '', now, now]
    );

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await pool.execute('INSERT IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)', [id, tag]);
      }
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('POST /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
});

// 更新笔记
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }

    if (fields.length > 0) {
      values.push(req.params.id);
      await pool.execute(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

// 删除笔记
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.execute('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

export default router;
