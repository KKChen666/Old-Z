/**
 * 全文搜索 API 路由。
 *
 * GET /api/search?q=关键词&kind=notes|todos|files|all
 *
 * 返回匹配的笔记、待办、文件列表，按 BM25 相关性排序。
 */

import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { searchAll, searchByKind, rebuildUserIndex } from '../services/search.js';

const router = Router();
router.use(authMiddleware);

// ---- 通用搜索 ----
router.get('/', async (req: AuthRequest, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const kind = String(req.query.kind || 'all') as 'note' | 'todo' | 'file' | 'all';
    const limit = parseInt(String(req.query.limit || '50'), 10);

    if (!query || [...query].length < 2) {
      res.json({ success: true, results: [], query });
      return;
    }

    const results = await searchAll(query, {
      kind,
      userId: req.userId!,
      limit: Math.min(limit, 200),
    });

    res.json({ success: true, results, query, kind, total: results.length });
  } catch (error: any) {
    console.error('[Search] Error:', error?.message || error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

// ---- 限定类型搜索 ----
router.get('/notes', async (req: AuthRequest, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const limit = parseInt(String(req.query.limit || '50'), 10);

    if (!query || [...query].length < 2) {
      res.json({ success: true, results: [] });
      return;
    }

    const results = await searchByKind('note', [query], {
      userId: req.userId!,
      limit: Math.min(limit, 200),
    });

    res.json({ success: true, results, total: results.length });
  } catch (error: any) {
    console.error('[Search] Error:', error?.message || error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

router.get('/todos', async (req: AuthRequest, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const limit = parseInt(String(req.query.limit || '50'), 10);

    if (!query || [...query].length < 2) {
      res.json({ success: true, results: [] });
      return;
    }

    const results = await searchByKind('todo', [query], {
      userId: req.userId!,
      limit: Math.min(limit, 200),
    });

    res.json({ success: true, results, total: results.length });
  } catch (error: any) {
    console.error('[Search] Error:', error?.message || error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

router.get('/files', async (req: AuthRequest, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const limit = parseInt(String(req.query.limit || '50'), 10);

    if (!query || [...query].length < 2) {
      res.json({ success: true, results: [] });
      return;
    }

    const results = await searchByKind('file', [query], {
      userId: req.userId!,
      limit: Math.min(limit, 200),
    });

    res.json({ success: true, results, total: results.length });
  } catch (error: any) {
    console.error('[Search] Error:', error?.message || error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

// ---- 重建索引 ----
router.post('/rebuild', async (req: AuthRequest, res) => {
  try {
    const count = await rebuildUserIndex(req.userId!);
    res.json({ success: true, message: `已重建 ${count} 条索引` });
  } catch (error: any) {
    console.error('[Search] Rebuild error:', error?.message || error);
    res.status(500).json({ success: false, error: '重建索引失败' });
  }
});

export default router;
