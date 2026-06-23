import { Router, type Request, type Response } from 'express';
import pool from '../db.js';

const router = Router();

// 获取所有文件
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [files] = await pool.execute('SELECT * FROM files ORDER BY created_at DESC');
    const [tags] = await pool.execute('SELECT * FROM file_tags');

    const tagMap = new Map<string, string[]>();
    (tags as any[]).forEach((t) => {
      if (!tagMap.has(t.file_id)) tagMap.set(t.file_id, []);
      tagMap.get(t.file_id)!.push(t.tag);
    });

    const result = (files as any[]).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      tags: tagMap.get(f.id) || [],
      content: f.content,
      thumbnail: f.thumbnail,
      url: f.url,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /files error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

// 创建文件
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, type, size, tags, content, thumbnail, url } = req.body;
    const now = new Date();

    await pool.execute(
      'INSERT INTO files (id, name, type, size, content, thumbnail, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, type || 'other', size || 0, content || null, thumbnail || null, url || null, now, now]
    );

    if (tags && tags.length > 0) {
      const tagValues = tags.map((t: string) => [id, t]);
      for (const [fid, tag] of tagValues) {
        await pool.execute('INSERT IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)', [fid, tag]);
      }
    }

    res.json({ success: true, data: { id, name, type, size, tags, content, thumbnail, url, createdAt: now, updatedAt: now } });
  } catch (error) {
    console.error('POST /files error:', error);
    res.status(500).json({ success: false, error: 'Failed to create file' });
  }
});

// 删除文件
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.execute('DELETE FROM files WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /files error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

export default router;
