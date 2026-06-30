import { Router, type Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取所有文件
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [files] = await pool.execute('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC', [req.userId!]);
    const [tags] = await pool.execute('SELECT ft.* FROM file_tags ft JOIN files f ON ft.file_id = f.id WHERE f.user_id = ?', [req.userId!]);

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
const VALID_FILE_TYPES = ['document', 'image', 'pdf', 'link', 'email', 'other'];

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, type, size, tags, content, thumbnail, url } = req.body;

    if (!name || typeof name !== 'string' || name.length > 500) {
      res.status(400).json({ success: false, error: '文件名无效或过长' });
      return;
    }
    if (type && !VALID_FILE_TYPES.includes(type)) {
      res.status(400).json({ success: false, error: '无效的文件类型' });
      return;
    }

    const now = new Date();

    await pool.execute(
      'INSERT INTO files (id, name, type, size, content, thumbnail, url, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, type || 'other', size || 0, content || null, thumbnail || null, url || null, now, now, req.userId]
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
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [result] = await pool.execute('DELETE FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.userId!]) as any;
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /files error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

export default router;
