import express, { Router, type Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import OSS from 'ali-oss';

const router = Router();
router.use(authMiddleware);

// 后端 OSS 配置 — 凭证仅在服务端使用，不暴露给前端
const ossClient = (process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET)
  ? new OSS({
      region: process.env.OSS_REGION || 'oss-cn-beijing',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET || 'oldzz',
    })
  : null;

function generateOSSKey(fileName: string, folder: string = 'uploads'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const ext = fileName.split('.').pop() || '';
  const nameWithoutExt = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  return `${folder}/${timestamp}_${random}_${nameWithoutExt}.${ext}`;
}

/**
 * 文件上传代理 — 前端将文件以 raw binary 发送，后端代传 OSS
 * POST /api/files/upload
 * Headers: x-file-name, x-file-folder (optional)
 * Body: raw binary
 */
router.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req: AuthRequest, res: Response) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ success: false, error: '文件内容为空' });
      return;
    }

    const fileName = (req.headers['x-file-name'] as string) || `file-${Date.now()}`;
    const folder = (req.headers['x-file-folder'] as string) || 'uploads';

    // 未配置 OSS 时回退到 base64 data URL（仅限小文件）
    if (!ossClient) {
      if (req.body.length > 2 * 1024 * 1024) {
        res.status(413).json({ success: false, error: '服务器未配置 OSS，文件超过 2MB 限制' });
        return;
      }
      const ext = fileName.split('.').pop() || 'bin';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        pdf: 'application/pdf', txt: 'text/plain', json: 'application/json',
        doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv', mp4: 'video/mp4', webm: 'video/webm',
      };
      const mime = mimeMap[ext.toLowerCase()] || 'application/octet-stream';
      const dataUrl = `data:${mime};base64,${req.body.toString('base64')}`;
      res.json({ success: true, data: { url: dataUrl, key: `local/${fileName}` } });
      return;
    }

    const key = generateOSSKey(fileName, folder);
    const result = await ossClient.put(key, req.body);
    // 强制 HTTPS
    const url = result.url ? result.url.replace(/^http:\/\//, 'https://') : '';
    res.json({ success: true, data: { url, key: result.name } });
  } catch (error: any) {
    console.error('POST /files/upload error:', error);
    res.status(500).json({ success: false, error: '文件上传失败' });
  }
});

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
