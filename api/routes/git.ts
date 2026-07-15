/**
 * Git 版本控制 API。
 *
 * 为本地模式提供真实的 Git 操作接口。
 * 不需要认证中间件 —— 本地模式本身就是离线/本地优先的。
 * 云端模式也可使用（如果服务端有 git）。
 */

import { Router, type NextFunction, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { materializeAllGitContent } from '../services/git-content.js';
import {
  ensureRepo,
  getInfo,
  getStatus,
  getLog,
  getDiff,
  commit,
  getRemotes,
  addRemote,
  removeRemote,
  push,
  pull,
  getBranches,
} from '../services/git.js';

const router = Router();
router.use(authMiddleware);
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.storage !== 'local') {
    res.status(403).json({ success: false, error: 'Git 版本历史仅供本地模式使用' });
    return;
  }
  next();
});

// 简单的错误包装
function handle(handler: (req: AuthRequest, res: Response) => Promise<void>) {
  return async (req: AuthRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Git API] ${req.method} ${req.path} error:`, message);
      res.status(500).json({
        success: false,
        error: message || 'Git 操作失败',
      });
    }
  };
}

// ============ 仓库信息 ============

router.get('/info', handle(async (req, res) => {
  await ensureRepo();
  await materializeAllGitContent(req.userId!);
  const snapshotStatus = await getStatus();
  if (!snapshotStatus.isClean) await commit('snapshot: synchronize local notes and todos');
  // 首次访问自动初始化仓库
  await ensureRepo();
  const info = await getInfo();
  res.json({ success: true, data: info });
}));

// ============ 状态 ============

router.get('/status', handle(async (_req, res) => {
  const status = await getStatus();
  res.json({ success: true, data: status });
}));

// ============ 提交历史 ============

router.get('/log', handle(async (req, res) => {
  const requestedLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const maxCount = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 50;
  const file = req.query.file ? String(req.query.file) : undefined;
  if (file && (file.startsWith('-') || file.includes('..'))) {
    res.status(400).json({ success: false, error: '无效的文件路径' });
    return;
  }
  const log = await getLog({ maxCount, file });
  res.json({ success: true, data: log });
}));

// ============ Diff ============

router.get('/diff/:hash', handle(async (req, res) => {
  if (!/^[0-9a-f]{7,40}$/i.test(req.params.hash)) {
    res.status(400).json({ success: false, error: '无效的提交 ID' });
    return;
  }
  const diff = await getDiff(req.params.hash);
  res.json({ success: true, data: diff });
}));

// ============ 提交 ============

router.post('/commit', handle(async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ success: false, error: '请提供 commit message' });
    return;
  }
  const result = await commit(message.trim());
  res.json({ success: true, data: result });
}));

// ============ 远端管理 ============

router.get('/remotes', handle(async (_req, res) => {
  const remotes = await getRemotes();
  res.json({ success: true, data: remotes });
}));

router.post('/remote', handle(async (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) {
    res.status(400).json({ success: false, error: '请提供 name 和 url' });
    return;
  }
  await addRemote(String(name), String(url));
  res.json({ success: true, data: { name, url } });
}));

router.delete('/remote/:name', handle(async (req, res) => {
  await removeRemote(req.params.name);
  res.json({ success: true, data: { removed: req.params.name } });
}));

// ============ 推送 / 拉取 ============

router.post('/push', handle(async (req, res) => {
  const { remote, branch } = req.body;
  if (!remote || !branch) {
    res.status(400).json({ success: false, error: '请提供 remote 和 branch' });
    return;
  }
  const result = await push(String(remote), String(branch));
  res.json({ success: true, data: result });
}));

router.post('/pull', handle(async (req, res) => {
  const { remote, branch } = req.body;
  if (!remote || !branch) {
    res.status(400).json({ success: false, error: '请提供 remote 和 branch' });
    return;
  }
  const result = await pull(String(remote), String(branch));
  res.json({ success: true, data: result });
}));

// ============ 分支 ============

router.get('/branches', handle(async (_req, res) => {
  const branches = await getBranches();
  res.json({ success: true, data: branches });
}));

export default router;
