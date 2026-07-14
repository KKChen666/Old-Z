import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { fetchLlmBalance, getUserLlmSettings, saveUserLlmConfig } from '../services/settings.js';
import db from '../config/db.js';

const router = Router();
router.use(authMiddleware);

// ============ 读取 LLM 配置（密钥脱敏）============
router.get('/llm', async (req: AuthRequest, res: Response) => {
  try {
    const config = await getUserLlmSettings(req.userId!);
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('GET /settings/llm error:', error);
    res.status(500).json({ success: false, error: 'Failed to load LLM config' });
  }
});

// ============ 保存 LLM 配置 ============
router.post('/llm', async (req: AuthRequest, res: Response) => {
  try {
    await saveUserLlmConfig(req.userId!, req.body);
    res.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error('POST /settings/llm error:', error);
    res.status(500).json({ success: false, error: 'Failed to save LLM config' });
  }
});

router.post('/llm/balance', async (req: AuthRequest, res: Response) => {
  try {
    const result = await fetchLlmBalance(req.body?.preset);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('POST /settings/llm/balance error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch LLM balance' });
  }
});

// ============ 同步密钥管理 ============

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** 生成同步密钥（仅云端账户可用） */
router.post('/sync-key/generate', async (req: AuthRequest, res: Response) => {
  try {
    const key = 'sk-oldz-' + crypto.randomBytes(24).toString('hex');
    const keyId = crypto.randomUUID();
    const label = req.body?.label || '默认密钥';
    await db.execute(
      'INSERT INTO quantlife_sync_keys (id, user_id, key_hash, label, created_at) VALUES (?, ?, ?, ?, NOW())',
      [keyId, req.userId!, hashKey(key), label]
    );
    res.json({ success: true, data: { key, id: keyId, label } });
  } catch (e: any) {
    console.error('Generate sync key:', e);
    res.status(500).json({ success: false, error: '生成失败' });
  }
});

/** 列出已有密钥 */
router.get('/sync-keys', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, label, created_at FROM quantlife_sync_keys WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId!]
    );
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

/** 删除密钥 */
router.delete('/sync-key/:id', async (req: AuthRequest, res: Response) => {
  try {
    await db.execute('DELETE FROM quantlife_sync_keys WHERE id = ? AND user_id = ?', [req.params.id, req.userId!]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

export default router;
