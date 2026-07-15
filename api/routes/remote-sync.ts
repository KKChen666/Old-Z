/**
 * 远程同步路由（供本地模式前端调用）。
 *
 * 前端只管理同步密钥，通过此 API 触发 push/pull。
 * 在线服务地址由服务端统一配置，客户端提交的地址不会被采用。
 */

import { Router, type NextFunction, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  pushToRemote,
  pullFromRemote,
  getRemoteSyncPreview,
  getRemoteSyncStatus,
  testConnection,
  type SyncSelection,
} from '../services/remote-sync.js';

const router = Router();
router.use(authMiddleware);
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.storage !== 'local') {
    res.status(403).json({ success: false, error: '在线同步仅供本地模式使用' });
    return;
  }
  next();
});

function handle(handler: (req: AuthRequest, res: Response) => Promise<void>) {
  return async (req: AuthRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[RemoteSync] ${req.method} ${req.path} error:`, message);
      res.status(500).json({ success: false, error: message || '同步操作失败' });
    }
  };
}

function parseSelection(value: unknown): SyncSelection | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as { notes?: unknown; todos?: unknown };
  return {
    notes: Array.isArray(input.notes) ? input.notes.filter((id): id is string => typeof id === 'string') : [],
    todos: Array.isArray(input.todos) ? input.todos.filter((id): id is string => typeof id === 'string') : [],
  };
}

// ============ Preview ============

router.post('/preview', handle(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    res.status(400).json({ success: false, error: '请提供同步密钥' });
    return;
  }
  const result = await getRemoteSyncPreview({ name: '', key });
  res.json({ success: true, data: result });
}));

// ============ Status ============

router.post('/status', handle(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    res.status(400).json({ success: false, error: '请提供同步密钥' });
    return;
  }
  const result = await getRemoteSyncStatus({ name: '', key });
  res.json({ success: true, data: result });
}));

// ============ Push ============

router.post('/push', handle(async (req, res) => {
  const { name, key, selection } = req.body;
  if (!key) {
    res.status(400).json({ success: false, error: '请提供同步密钥' });
    return;
  }
  const result = await pushToRemote({ name: name || '', key }, parseSelection(selection));
  res.json({ success: true, data: result });
}));

// ============ Test Connection ============

router.post('/test', handle(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    res.status(400).json({ success: false, error: '请提供同步密钥' });
    return;
  }
  const result = await testConnection({ name: '', key });
  res.json({ success: true, data: result });
}));

// ============ Pull ============

router.post('/pull', handle(async (req, res) => {
  const { name, key, selection } = req.body;
  if (!key) {
    res.status(400).json({ success: false, error: '请提供同步密钥' });
    return;
  }
  const result = await pullFromRemote({ name: name || '', key }, parseSelection(selection));
  res.json({ success: true, data: result });
}));

export default router;
