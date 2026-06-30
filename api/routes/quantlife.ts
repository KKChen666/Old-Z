import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  getDefaultProgressData,
  getUserProgress, saveUserProgress,
  getUserLlmConfig, maskLlmConfig, saveUserLlmConfig,
  countEncodingAnomalies,
  buildIngestSystemPrompt, buildIngestUserMessage, validateAndApplyIngest,
  getEnabledDimensionKeys,
  PLAN_SYSTEM_PROMPT, buildPlanUserMessage,
} from '../services/quantlife.js';
import { callLLM, safeJsonParse } from '../services/ai.js';

const router = Router();
router.use(authMiddleware);

// ============ 健康检查 ============
router.get('/health', async (req: AuthRequest, res: Response) => {
  try {
    const config = await getUserLlmConfig(req.userId!);
    const configured = !!(config && (
      (config.provider === 'openai' && config.openai_api_key) ||
      (config.provider === 'anthropic' && config.anthropic_auth_token)
    ));
    res.json({
      success: true,
      data: { status: 'ok', provider: config?.provider || 'openai', llm_configured: configured },
    });
  } catch (error) {
    console.error('GET /quantlife/health error:', error);
    res.status(500).json({ success: false, error: 'Failed to check health' });
  }
});

// ============ 读取进度 ============
router.get('/progress', async (req: AuthRequest, res: Response) => {
  try {
    let progress = await getUserProgress(req.userId!);
    if (!progress) progress = getDefaultProgressData();
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('GET /quantlife/progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to load progress' });
  }
});

// ============ 保存进度 ============
router.post('/progress', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid progress data' });
      return;
    }

    const anomalies = countEncodingAnomalies(JSON.stringify(payload));
    if (anomalies > 5) {
      res.status(400).json({ success: false, error: '检测到编码异常，保存已阻止以保护数据完整性' });
      return;
    }

    await saveUserProgress(req.userId!, payload);
    res.json({ success: true, data: { saved_at: new Date().toISOString() } });
  } catch (error) {
    console.error('POST /quantlife/progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to save progress' });
  }
});

// ============ 读取 LLM 配置（密钥脱敏）============
router.get('/llm-config', async (req: AuthRequest, res: Response) => {
  try {
    const config = await getUserLlmConfig(req.userId!);
    res.json({ success: true, data: maskLlmConfig(config) });
  } catch (error) {
    console.error('GET /quantlife/llm-config error:', error);
    res.status(500).json({ success: false, error: 'Failed to load LLM config' });
  }
});

// ============ 保存 LLM 配置 ============
router.post('/llm-config', async (req: AuthRequest, res: Response) => {
  try {
    await saveUserLlmConfig(req.userId!, req.body);
    res.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error('POST /quantlife/llm-config error:', error);
    res.status(500).json({ success: false, error: 'Failed to save LLM config' });
  }
});

// ============ AI 文本解析 ============
router.post('/ingest/text', async (req: AuthRequest, res: Response) => {
  try {
    const { date, text, hint_dimension_key } = req.body;
    if (!date || !text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ success: false, error: '请输入活动描述文本' });
      return;
    }

    const llmConfig = await getUserLlmConfig(req.userId!);
    if (!llmConfig) {
      res.status(400).json({ success: false, error: '请先在设置中配置 AI 接口' });
      return;
    }

    let progress = await getUserProgress(req.userId!);
    if (!progress) progress = getDefaultProgressData();

    const enabledKeys = getEnabledDimensionKeys(progress);
    const dimensionDefs = progress?.meta?.dimensions?.defs || {};

    const systemPrompt = buildIngestSystemPrompt(date, enabledKeys, dimensionDefs, hint_dimension_key);
    const userMessage = buildIngestUserMessage(text, hint_dimension_key);

    let llmResult: string;
    try {
      llmResult = await callLLM(llmConfig, systemPrompt, userMessage, { jsonMode: true, timeoutMs: 25000 });
    } catch (llmErr: any) {
      console.error('LLM call failed:', llmErr?.message || llmErr);
      res.status(502).json({ success: false, error: `AI 调用失败：${llmErr?.message || '未知错误'}` });
      return;
    }

    const parsed = safeJsonParse(llmResult);
    if (!parsed || !Array.isArray(parsed.activities) || parsed.activities.length === 0) {
      res.status(422).json({ success: false, error: 'AI 返回结果解析失败，请重试' });
      return;
    }

    const validatedEntries = validateAndApplyIngest(progress, parsed.activities, date, enabledKeys, dimensionDefs);
    if (validatedEntries.length === 0) {
      res.status(422).json({ success: false, error: '没有解析到有效的活动条目，请检查维度配置或描述内容' });
      return;
    }

    await saveUserProgress(req.userId!, progress);

    res.json({
      success: true,
      data: { ok: true, parsed: validatedEntries, applied_entries: validatedEntries, progress },
    });
  } catch (error) {
    console.error('POST /quantlife/ingest/text error:', error);
    res.status(500).json({ success: false, error: 'AI 文本解析失败' });
  }
});

// ============ AI 规划方向 ============
router.post('/plan/direction', async (req: AuthRequest, res: Response) => {
  try {
    const { goal, context, stages } = req.body;
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      res.status(400).json({ success: false, error: '请输入目标' });
      return;
    }

    const llmConfig = await getUserLlmConfig(req.userId!);
    if (!llmConfig) {
      res.status(400).json({ success: false, error: '请先在设置中配置 AI 接口' });
      return;
    }

    let progress = await getUserProgress(req.userId!);
    if (!progress) progress = getDefaultProgressData();

    const systemPrompt = PLAN_SYSTEM_PROMPT;
    const userMessage = buildPlanUserMessage(goal, context, stages);

    let llmResult: string;
    try {
      llmResult = await callLLM(llmConfig, systemPrompt, userMessage, { jsonMode: true, timeoutMs: 25000 });
    } catch (llmErr: any) {
      console.error('LLM plan call failed:', llmErr?.message || llmErr);
      res.status(502).json({ success: false, error: `AI 调用失败：${llmErr?.message || '未知错误'}` });
      return;
    }

    const parsed = safeJsonParse(llmResult);
    if (!parsed || !parsed.main_line) {
      res.status(422).json({ success: false, error: 'AI 返回结果解析失败，请重试' });
      return;
    }

    progress.ai_plan_direction = {
      goal,
      context: context || '',
      main_line: parsed.main_line || '',
      today_actions: Array.isArray(parsed.today_actions) ? parsed.today_actions : [],
      stages: stages || [],
      updated_at: new Date().toISOString(),
    };
    progress.meta.last_synced_at = new Date().toISOString();

    await saveUserProgress(req.userId!, progress);

    res.json({
      success: true,
      data: { main_line: parsed.main_line, today_actions: parsed.today_actions || [], progress },
    });
  } catch (error) {
    console.error('POST /quantlife/plan/direction error:', error);
    res.status(500).json({ success: false, error: 'AI 规划生成失败' });
  }
});

export default router;
