import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  chatWithAI,
  chatWithAIStream,
  loadChatHistory,
  loadNoteContext,
  loadNoteMeta,
  loadUserContext,
  saveUserMessage,
  saveAiMessage,
  createChatTimelineEvent,
  planDirection,
  suggestChatActions,
  createChatConversation,
  deleteChatConversation,
  deleteChatMessage,
  deleteLastExchange,
  ensureChatConversation,
  loadChatConversations,
  renameChatConversation,
  touchChatConversation,
  generateTextWithAI,
  normalizeChatReferences,
  loadChatReferenceDetails,
  buildReferencedPrompt,
  saveChatReferences,
} from '../services/chat.js';

const router = Router();
router.use(authMiddleware);

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await loadChatConversations(req.userId!);
    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('GET /chat/conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const { title, scope: rawScope, noteId } = req.body;
    const scope = rawScope === 'note' ? 'note' : 'global';
    const conversation = await createChatConversation(req.userId!, {
      title: typeof title === 'string' ? title : '新对话',
      scope,
      noteId: scope === 'note' && typeof noteId === 'string' ? noteId : undefined,
    });
    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error('POST /chat/conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

router.patch('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      res.status(400).json({ success: false, error: '标题不能为空' });
      return;
    }
    await renameChatConversation(req.userId!, req.params.id, title);
    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /chat/conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to rename conversation' });
  }
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteChatConversation(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /chat/conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
});

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ success: false, error: '生成内容不能为空' });
      return;
    }
    if (prompt.length > 30000) {
      res.status(400).json({ success: false, error: '生成内容过长' });
      return;
    }

    const content = await generateTextWithAI(req.userId!, prompt);
    res.json({ success: true, data: { content } });
  } catch (error: any) {
    console.error('POST /chat/generate error:', error);
    res.status(500).json({ success: false, error: error.message || 'AI 生成失败' });
  }
});

// 获取所有聊天消息
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const scope = req.query.scope === 'note' ? 'note' : req.query.scope === 'global' ? 'global' : undefined;
    const noteId = typeof req.query.noteId === 'string' ? req.query.noteId : undefined;
    const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
    const result = await loadChatHistory(req.userId!, { scope, noteId, conversationId });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// 发送消息并获取AI回复
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { content, scope: rawScope, noteId: rawNoteId, conversationId: rawConversationId, references: rawReferences } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: '消息内容不能为空' });
      return;
    }
    if (content.length > 10000) {
      res.status(400).json({ success: false, error: '消息内容过长' });
      return;
    }

    const scope = rawScope === 'note' ? 'note' : 'global';
    const noteId = scope === 'note' && typeof rawNoteId === 'string' ? rawNoteId : undefined;
    const requestedConversationId = typeof rawConversationId === 'string' ? rawConversationId : undefined;
    const requestedReferences = normalizeChatReferences(rawReferences);
    const referenceDetails = await loadChatReferenceDetails(req.userId!, requestedReferences);
    const referencedContent = buildReferencedPrompt(content, referenceDetails);
    let noteMeta: { id: string; title: string } | undefined;

    if (scope === 'note') {
      if (!noteId) {
        res.status(400).json({ success: false, error: '缺少笔记 ID' });
        return;
      }
      noteMeta = await loadNoteMeta(req.userId!, noteId);
    }

    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const aiMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const conversation = await ensureChatConversation(req.userId!, {
      conversationId: requestedConversationId,
      scope,
      noteId,
      title: content.slice(0, 32),
    });

    // 保存用户消息
    const now = await saveUserMessage(req.userId!, userMsgId, content, { scope, noteId, conversationId: conversation.id });
    await saveChatReferences(userMsgId, referenceDetails);

    // 加载历史与上下文
    const history = await loadChatHistory(req.userId!, { scope, noteId, conversationId: conversation.id });
    const context = scope === 'note' && noteId
      ? await loadNoteContext(req.userId!, noteId)
      : await loadUserContext(req.userId!);

    // 调用AI
    const aiContent = await chatWithAI(
      req.userId!,
      referencedContent,
      history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
      context
    );

    // 保存AI回复
    const aiTime = await saveAiMessage(req.userId!, aiMsgId, aiContent, { scope, noteId, conversationId: conversation.id });
    await touchChatConversation(req.userId!, conversation.id, content);

    // 记录时间轴
    await createChatTimelineEvent(req.userId!);

    res.json({
      success: true,
      data: {
        conversation,
        userMessage: { id: userMsgId, role: 'user', content, timestamp: now, scope, noteId, noteTitle: noteMeta?.title, conversationId: conversation.id, references: referenceDetails.map((ref) => ({ type: ref.type, id: ref.id, title: ref.title })) },
        aiMessage: { id: aiMsgId, role: 'assistant', content: aiContent, timestamp: aiTime, scope, noteId, noteTitle: noteMeta?.title, conversationId: conversation.id },
      },
    });
  } catch (error) {
    console.error('POST /chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to chat' });
  }
});

// ============ 流式 AI 聊天（SSE）============
router.post('/stream', async (req: AuthRequest, res: Response) => {
  try {
    const { content, scope: rawScope, noteId: rawNoteId, conversationId: rawConversationId, references: rawReferences } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: '消息内容不能为空' });
      return;
    }
    if (content.length > 10000) {
      res.status(400).json({ success: false, error: '消息内容过长' });
      return;
    }

    const scope = rawScope === 'note' ? 'note' : 'global';
    const noteId = scope === 'note' && typeof rawNoteId === 'string' ? rawNoteId : undefined;
    const requestedConversationId = typeof rawConversationId === 'string' ? rawConversationId : undefined;
    const requestedReferences = normalizeChatReferences(rawReferences);
    const referenceDetails = await loadChatReferenceDetails(req.userId!, requestedReferences);
    const referencedContent = buildReferencedPrompt(content, referenceDetails);
    let noteMeta: { id: string; title: string } | undefined;

    if (scope === 'note') {
      if (!noteId) {
        res.status(400).json({ success: false, error: '缺少笔记 ID' });
        return;
      }
      noteMeta = await loadNoteMeta(req.userId!, noteId);
    }

    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const aiMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const conversation = await ensureChatConversation(req.userId!, {
      conversationId: requestedConversationId,
      scope,
      noteId,
      title: content.slice(0, 32),
    });

    // 保存用户消息
    const now = await saveUserMessage(req.userId!, userMsgId, content, { scope, noteId, conversationId: conversation.id });
    await saveChatReferences(userMsgId, referenceDetails);

    // 加载历史与上下文
    const history = await loadChatHistory(req.userId!, { scope, noteId, conversationId: conversation.id });
    const context = scope === 'note' && noteId
      ? await loadNoteContext(req.userId!, noteId)
      : await loadUserContext(req.userId!);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

    // 发送初始元数据
    res.write(`data: ${JSON.stringify({ type: 'meta', conversation, userMessage: { id: userMsgId, role: 'user', content, timestamp: now, scope, noteId, noteTitle: noteMeta?.title, conversationId: conversation.id, references: referenceDetails.map((ref) => ({ type: ref.type, id: ref.id, title: ref.title })) }, aiMessageId: aiMsgId })}\n\n`);

    // 流式调用 AI
    let aiContent = '';
    try {
      aiContent = await chatWithAIStream(
        req.userId!,
        referencedContent,
        history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
        context,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      );
    } catch (aiError: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: aiError.message || 'AI 调用失败' })}\n\n`);
      res.end();
      return;
    }

    // 保存 AI 回复
    const aiTime = await saveAiMessage(req.userId!, aiMsgId, aiContent, { scope, noteId, conversationId: conversation.id });
    await touchChatConversation(req.userId!, conversation.id, content);
    await createChatTimelineEvent(req.userId!);

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done', aiMessage: { id: aiMsgId, role: 'assistant', content: aiContent, timestamp: aiTime, scope, noteId, noteTitle: noteMeta?.title, conversationId: conversation.id } })}\n\n`);
    res.end();
  } catch (error) {
    console.error('POST /chat/stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to chat' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: '服务器内部错误' })}\n\n`);
      res.end();
    }
  }
});

// ============ 删除单条消息 ============
router.delete('/messages/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ok = await deleteChatMessage(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({ success: false, error: '消息不存在或无权操作' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /chat/messages/:id error:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// ============ 撤回最后一轮对话 ============
router.post('/withdraw', async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId || typeof conversationId !== 'string') {
      res.status(400).json({ success: false, error: '缺少对话 ID' });
      return;
    }
    const deleted = await deleteLastExchange(req.userId!, conversationId);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error('POST /chat/withdraw error:', error);
    res.status(500).json({ success: false, error: '撤回失败' });
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

router.post('/actions', async (req: AuthRequest, res: Response) => {
  try {
    const { message, aiReply } = req.body;
    if (!message || typeof message !== 'string' || !aiReply || typeof aiReply !== 'string') {
      res.status(400).json({ success: false, error: '缺少可分析的对话内容' });
      return;
    }

    const result = await suggestChatActions(req.userId!, message.slice(0, 10000), aiReply.slice(0, 20000));
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('POST /chat/actions error:', error);
    res.status(500).json({ success: false, error: error.message || 'AI 联动建议生成失败' });
  }
});

export default router;
