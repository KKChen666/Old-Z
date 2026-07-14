import { Router, type Response } from 'express';
import db, { upsert } from '../config/db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { generateMissingReports } from '../services/report-generation.js';

const router = Router();
router.use(authMiddleware);

function reportId(): string {
  return `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

router.get('/daily', async (req: AuthRequest, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const month = typeof req.query.month === 'string' ? req.query.month : '';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, error: '日期格式无效' });
      return;
    }
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, error: '月份格式无效' });
      return;
    }

    if (date) {
      const [rows] = await db.execute(
        'SELECT * FROM daily_reports WHERE user_id = ? AND report_date = ? LIMIT 1',
        [req.userId!, date]
      );
      const report = (rows as any[])[0];
      res.json({
        success: true,
        data: report ? {
          id: report.id,
          date: report.report_date,
          content: report.content,
          createdAt: report.created_at,
          updatedAt: report.updated_at,
        } : null,
      });
      return;
    }

    if (month) {
      const [rows] = await db.execute(
        `SELECT *
         FROM daily_reports
         WHERE user_id = ? AND substr(report_date, 1, 7) = ?
         ORDER BY report_date ASC`,
        [req.userId!, month]
      );
      res.json({
        success: true,
        data: (rows as any[]).map((report) => ({
          id: report.id,
          date: report.report_date,
          content: report.content,
          createdAt: report.created_at,
          updatedAt: report.updated_at,
        })),
      });
      return;
    }

    res.status(400).json({ success: false, error: '请提供 date 或 month' });
  } catch (error) {
    console.error('GET /reports/daily error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily reports' });
  }
});

router.put('/daily', async (req: AuthRequest, res: Response) => {
  try {
    const { date, content } = req.body;
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, error: '日期格式无效' });
      return;
    }
    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: '日报内容不能为空' });
      return;
    }

    await upsert('daily_reports',
      ['id', 'user_id', 'report_date', 'content', 'updated_at'],
      [reportId(), req.userId!, date, content, new Date().toISOString().slice(0, 19).replace('T', ' ')],
      ['user_id', 'report_date']
    );

    res.json({ success: true, data: { date, content } });
  } catch (error) {
    console.error('PUT /reports/daily error:', error);
    res.status(500).json({ success: false, error: 'Failed to save daily report' });
  }
});

// ============ 手动触发报告生成 ============
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const reports = await generateMissingReports(req.userId!);
    res.json({
      success: true,
      data: {
        generated: reports.length,
        reports: reports.map((r) => ({ kind: r.kind, date: r.reportDate })),
      },
    });
  } catch (error: any) {
    console.error('POST /reports/generate error:', error);
    res.status(500).json({ success: false, error: error.message || '报告生成失败' });
  }
});

export default router;
