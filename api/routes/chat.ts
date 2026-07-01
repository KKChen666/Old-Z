import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  chatWithAI,
  loadChatHistory,
  loadUserContext,
  saveUserMessage,
  saveAiMessage,
  createChatTimelineEvent,
  planDirection,
} from '../services/chat.js';

const router = Router();
router.use(authMiddleware);

// 获取所有聊天消息
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await loadChatHistory(req.userId!);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// 发送消息并获取AI回复
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: '消息内容不能为空' });
      return;
    }
    if (content.length > 10000) {
      res.status(400).json({ success: false, error: '消息内容过长' });
      return;
    }

    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const aiMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 保存用户消息
    const now = await saveUserMessage(req.userId!, userMsgId, content);

    // 加载历史与上下文
    const history = await loadChatHistory(req.userId!);
    const context = await loadUserContext(req.userId!);

    // 调用AI
    const aiContent = await chatWithAI(
      req.userId!,
      content,
      history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
      context
    );

    // 保存AI回复
    const aiTime = await saveAiMessage(req.userId!, aiMsgId, aiContent);

    // 记录时间轴
    await createChatTimelineEvent(req.userId!);

    res.json({
      success: true,
      data: {
        userMessage: { id: userMsgId, role: 'user', content, timestamp: now },
        aiMessage: { id: aiMsgId, role: 'assistant', content: aiContent, timestamp: aiTime },
      },
    });
  } catch (error) {
    console.error('POST /chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to chat' });
  }
});

// ============ AI 规划方向 ============
router.post('/plan', async (req: AuthRequest, res: Response) => {
  try {
    const { goal, context, stages } = req.body;
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      res.status(400).json({ success: false, error: '请输入目标' });
      return;
    }

    const result = await planDirection(req.userId!, goal.trim(), (context || '').trim(), stages || []);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('POST /chat/plan error:', error);
    res.status(500).json({ success: false, error: error.message || 'AI 规划生成失败' });
  }
});

export default router;
