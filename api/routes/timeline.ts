import { Router, type Request, type Response } from 'express';
import pool from '../db.js';

const router = Router();

// 获取所有时间轴事件
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [events] = await pool.execute('SELECT * FROM timeline_events ORDER BY timestamp DESC');

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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, type, title, description, relatedId } = req.body;
    const now = new Date();

    await pool.execute(
      'INSERT INTO timeline_events (id, type, title, description, related_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, type, title, description || null, relatedId || null, now]
    );

    res.json({ success: true, data: { id, type, title, description, relatedId, timestamp: now } });
  } catch (error) {
    console.error('POST /timeline error:', error);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

export default router;
