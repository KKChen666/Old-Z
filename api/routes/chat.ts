import { Router, type Request, type Response } from 'express';
import pool from '../db.js';
import { chatWithAI, type ChatContext } from '../chat/ai.js';

const router = Router();

// 获取所有聊天消息
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [messages] = await pool.execute('SELECT * FROM chat_messages ORDER BY timestamp ASC');
    const [refs] = await pool.execute('SELECT * FROM chat_references');

    const refMap = new Map<string, any[]>();
    (refs as any[]).forEach((r) => {
      if (!refMap.has(r.message_id)) refMap.set(r.message_id, []);
      refMap.get(r.message_id)!.push({ type: r.ref_type, id: r.ref_id });
    });

    const result = (messages as any[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      references: refMap.get(m.id) || [],
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// 发送消息并获取AI回复
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const now = new Date();
    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const aiMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 保存用户消息
    await pool.execute(
      'INSERT INTO chat_messages (id, role, content, timestamp) VALUES (?, ?, ?, ?)',
      [userMsgId, 'user', content, now]
    );

    // 获取聊天历史
    const [historyRows] = await pool.execute(
      'SELECT role, content FROM chat_messages ORDER BY timestamp ASC LIMIT 20'
    );
    const history = (historyRows as any[]).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // 获取用户数据上下文
    const [files] = await pool.execute(`
      SELECT f.name, f.type, GROUP_CONCAT(ft.tag) as tags
      FROM files f LEFT JOIN file_tags ft ON f.id = ft.file_id
      GROUP BY f.id
    `);
    const [todos] = await pool.execute('SELECT title, status, priority, due_date FROM todos');
    const [notes] = await pool.execute('SELECT title, content FROM notes');

    const context: ChatContext = {
      files: (files as any[]).map(f => ({ name: f.name, type: f.type, tags: f.tags ? f.tags.split(',') : [] })),
      todos: (todos as any[]).map(t => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.due_date })),
      notes: (notes as any[]).map(n => ({ title: n.title, content: n.content })),
    };

    // 调用AI
    const aiContent = await chatWithAI(content, history, context);

    // 保存AI回复
    await pool.execute(
      'INSERT INTO chat_messages (id, role, content, timestamp) VALUES (?, ?, ?, ?)',
      [aiMsgId, 'assistant', aiContent, new Date()]
    );

    // 保存时间轴
    await pool.execute(
      'INSERT INTO timeline_events (id, type, title, timestamp) VALUES (?, ?, ?, ?)',
      [`te-${Date.now()}`, 'chat', '与 AI 助手进行了对话', now]
    );

    res.json({
      success: true,
      data: {
        userMessage: { id: userMsgId, role: 'user', content, timestamp: now },
        aiMessage: { id: aiMsgId, role: 'assistant', content: aiContent, timestamp: new Date() },
      },
    });
  } catch (error) {
    console.error('POST /chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to chat' });
  }
});

export default router;
