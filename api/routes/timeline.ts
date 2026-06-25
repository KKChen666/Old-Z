import { Router, type Response } from 'express';
import pool from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取所有时间轴事件
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [events] = await pool.execute('SELECT * FROM timeline_events WHERE user_id = ? ORDER BY timestamp DESC', [req.userId]);

    const result = (events as any[]).map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      relatedId: e.related_id,
      timestamp: e.timestamp,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /timeline error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

// 创建时间轴事件
const VALID_EVENT_TYPES = ['file_upload', 'todo_created', 'todo_completed', 'note_created', 'note_edited', 'chat', 'ai_reminder'];

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { id, type, title, description, relatedId } = req.body;

    if (!title || typeof title !== 'string' || title.length > 500) {
      res.status(400).json({ success: false, error: '标题无效或过长' });
      return;
    }
    if (!type || !VALID_EVENT_TYPES.includes(type)) {
      res.status(400).json({ success: false, error: '无效的事件类型' });
      return;
    }

    const now = new Date();

    await pool.execute(
      'INSERT INTO timeline_events (id, type, title, description, related_id, timestamp, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, type, title, description || null, relatedId || null, now, req.userId]
    );

    res.json({ success: true, data: { id, type, title, description, relatedId, timestamp: now } });
  } catch (error) {
    console.error('POST /timeline error:', error);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

export default router;
