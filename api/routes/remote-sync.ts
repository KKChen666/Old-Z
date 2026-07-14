/**
 * 远程同步路由（供本地模式前端调用）。
 *
 * 前端管理一个远端配置（URL + sync key），通过此 API 触发 push/pull。
 * 本服务作为 HTTP 客户端，调用远端 Old Z 服务器的 /api/sync/* 接口。
 */

import { Router, type Request, type Response } from 'express';
import { pushToRemote, pullFromRemote, getRemoteSyncStatus, testConnection } from '../services/remote-sync.js';

const router = Router();

function handle(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      console.error(`[RemoteSync] ${req.method} ${req.path} error:`, error?.message || error);
      res.status(500).json({ success: false, error: error?.message || '同步操作失败' });
    }
  };
}

// ============ Status ============

router.post('/status', handle(async (req, res) => {
  const { url, key } = req.body;
  if (!url || !key) {
    res.status(400).json({ success: false, error: '请提供远端 URL 和同步密钥' });
    return;
  }
  const result = await getRemoteSyncStatus({ name: '', url, key });
  res.json({ success: true, data: result });
}));

// ============ Push ============

router.post('/push', handle(async (req, res) => {
  const { name, url, key } = req.body;
  if (!url || !key) {
    res.status(400).json({ success: false, error: '请提供远端 URL 和同步密钥' });
    return;
  }
  const result = await pushToRemote({ name: name || '', url, key });
  res.json({ success: true, data: result });
}));

// ============ Test Connection ============

router.post('/test', handle(async (req, res) => {
  const { url, key } = req.body;
  if (!url || !key) {
    res.status(400).json({ success: false, error: '请提供远端 URL 和同步密钥' });
    return;
  }
  const result = await testConnection({ name: '', url, key });
  res.json({ success: true, data: result });
}));

// ============ Pull ============

router.post('/pull', handle(async (req, res) => {
  const { name, url, key } = req.body;
  if (!url || !key) {
    res.status(400).json({ success: false, error: '请提供远端 URL 和同步密钥' });
    return;
  }
  const result = await pullFromRemote({ name: name || '', url, key });
  res.json({ success: true, data: result });
}));

export default router;
