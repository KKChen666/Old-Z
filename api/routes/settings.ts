import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getUserLlmConfig, maskLlmConfig, saveUserLlmConfig } from '../services/settings.js';

const router = Router();
router.use(authMiddleware);

// ============ 读取 LLM 配置（密钥脱敏）============
router.get('/llm', async (req: AuthRequest, res: Response) => {
  try {
    const config = await getUserLlmConfig(req.userId!);
    res.json({ success: true, data: maskLlmConfig(config) });
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

export default router;
