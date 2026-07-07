# Old Z 项目 - 团队并行修复任务分配指南

**生成时间**: 2026-07-07 10:41  
**总修复数**: 97 个（25 P0 + 36 P1 + 36 P2）  
**已自动完成**: 3 个  
**待修复**: 94 个  
**预计并行完成时间**: 3-5 天（2-3 人团队）

---

## 📋 任务分配总览

| 角色 | 负责修复数 | 预计工作量 | 主要文件范围 |
|------|-----------|-----------|-------------|
| 🔧 **后端开发者** | 28 个 | 2-3 天 | `api/` 目录 |
| 🎨 **前端开发者** | 48 个 | 2-3 天 | `src/` 目录 |
| ⚙️ **全栈/运维** | 18 个 | 1-2 天 | 跨目录 + 配置文件 |
| **合计** | 94 个 | 3-5 天（并行） | |

---

## 🔧 后端开发者任务清单（28 个修复）

### 优先级 P0 — 今天必须完成（6 个）

#### 任务 BE-01: 完成密码重置验证（V1）
- **文件**: `api/routes/auth.ts:129-180`
- **状态**: 🔄 50% 完成（已添加 oldPassword 参数，缺验证逻辑）
- **具体操作**:
  ```typescript
  // 1. 修改 SQL 查询，获取 password_hash
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username]
  );

  // 2. 验证旧密码
  const user = users[0];
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }
  ```
- **验证**: 用错误旧密码 → 401；用正确旧密码 → 成功
- **预计时间**: 30 分钟

#### 任务 BE-02: SSRF 防护（V4）
- **文件**: `api/services/settings.ts`
- **问题**: `fetchLlmBalance` 可请求任意 URL（含内网）
- **修复**:
  ```typescript
  // 添加 URL 安全验证
  function isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127 ||
      parts[0] === 0
    );
  }

  // 在 fetchLlmBalance 中使用
  const parsed = new URL(balance_url);
  if (isPrivateIP(parsed.hostname)) {
    throw new Error('不允许请求内网地址');
  }
  ```
- **预计时间**: 1 小时

#### 任务 BE-03: 创建 OSS 代理 API（V2）
- **文件**: 新建 `api/routes/oss.ts`
- **问题**: OSS 凭证暴露在前端
- **修复**:
  1. 新建 `api/routes/oss.ts`，实现：
     - `POST /api/oss/upload` — 接收文件，后端上传 OSS
     - `GET /api/oss/download/:key` — 后端下载并返回
     - `DELETE /api/oss/:key` — 后端删除
  2. 在 `api/app.ts` 注册路由
  3. 将 `.env` 中的 `VITE_OSS_*` 改为 `OSS_*`（去掉 VITE_ 前缀）
  4. 后端使用 `OSS_ACCESS_KEY_ID` 等变量
- **参考代码**:
  ```typescript
  // api/routes/oss.ts
  import OSS from 'ali-oss';
  import multer from 'multer';

  const client = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'oldzz',
  });

  const upload = multer({ storage: multer.memoryStorage() });

  router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
      const fileName = `${req.user!.id}/${Date.now()}-${req.file!.originalname}`;
      const result = await client.put(fileName, req.file!.buffer);
      res.json({ success: true, data: { url: result.url, key: fileName } });
    } catch (error) {
      res.status(500).json({ success: false, error: '上传失败' });
    }
  });
  ```
- **预计时间**: 4-6 小时

#### 任务 BE-04: JWT 改用 httpOnly Cookie（V5）
- **文件**: `api/routes/auth.ts`, `api/middleware/auth.ts`
- **问题**: JWT 存在 localStorage，XSS 可窃取
- **修复**:
  ```typescript
  // 登录/注册/重置密码成功后：
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  });

  // auth 中间件改为从 cookie 读取：
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  ```

  **注意**: 需要安装 `cookie-parser`，并在 `api/app.ts` 中使用
- **预计时间**: 1-1.5 小时

#### 任务 BE-05: CORS 白名单（V6）
- **文件**: `api/app.ts:33`
- **问题**: `app.use(cors())` 完全开放
- **修复**:
  ```typescript
  import cors from 'cors';

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://your-production-domain.com', // 替换为你的生产域名
    'capacitor://localhost', // Capacitor
    'http://localhost', // Capacitor Android
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // 允许携带 cookie
  }));
  ```
- **预计时间**: 30 分钟

#### 任务 BE-06: 添加 Helmet + Rate Limiting（V7）
- **文件**: `api/app.ts`
- **修复**:
  ```bash
  npm install helmet express-rate-limit
  ```
  ```typescript
  import helmet from 'helmet';
  import rateLimit from 'express-rate-limit';

  // 安全头
  app.use(helmet());

  // 通用速率限制
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 100, // 每 IP 每分钟 100 次
  });
  app.use('/api', apiLimiter);

  // 登录/密码重置严格限制
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 5, // 每 IP 15 分钟 5 次
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);
  ```
- **预计时间**: 1 小时

---

### 优先级 P1 — 本周完成（10 个）

#### 任务 BE-07: LLM API Key 移到后端（V8）
- **文件**: `api/services/llmRequestContext.ts`, `api/routes/chat.ts`
- **问题**: 前端通过 header 传输 API Key
- **修复**:
  1. API Key 存储在后端数据库 `settings` 表
  2. 前端不再发送 `x-oldz-local-llm-config` header
  3. 后端从数据库读取用户配置的 LLM 设置
  4. 前端通过 `/api/settings/llm` 获取/设置（不返回 key）
- **预计时间**: 2 小时

#### 任务 BE-08: 统一错误处理中间件（B-Q14）
- **文件**: 新建 `api/middleware/errorHandler.ts`
- **修复**:
  ```typescript
  // api/middleware/errorHandler.ts
  export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err);

    const isDev = process.env.NODE_ENV === 'development';

    res.status(err.status || 500).json({
      success: false,
      error: isDev ? err.message : '服务器内部错误',
      ...(isDev && { stack: err.stack }),
    });
  }

  // api/app.ts
  app.use(errorHandler); // 放在所有路由之后
  ```
- **预计时间**: 1 小时

#### 任务 BE-09: API 分页支持（P4）
- **文件**: `api/routes/files.ts`, `api/routes/todos.ts`, `api/routes/notes.ts`
- **修复**: 添加 `?page=1&limit=50` 支持
  ```typescript
  // api/routes/files.ts
  router.get('/', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      'SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, limit, offset]
    );
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM files WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: countRows[0].total }
    });
  });
  ```
- **预计时间**: 2 小时

#### 任务 BE-10: todos 查询优化（P5）
- **文件**: `api/routes/todos.ts:9-55`
- **问题**: 5 次独立查询
- **修复**: 用 `Promise.all` 并行查询，或用 JOIN
  ```typescript
  const [todos, tags, subtasks, files, notes] = await Promise.all([
    pool.execute('SELECT * FROM todos WHERE user_id = ?', [req.user.id]),
    pool.execute('SELECT * FROM todo_tags WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)', [req.user.id]),
    pool.execute('SELECT * FROM subtasks WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)', [req.user.id]),
    pool.execute('SELECT * FROM todo_files WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)', [req.user.id]),
    pool.execute('SELECT * FROM todo_notes WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)', [req.user.id]),
  ]);
  ```
- **预计时间**: 1 小时

#### 任务 BE-11: 服务端生成 ID（B-Q14）
- **文件**: 所有 `POST` 路由
- **问题**: 客户端传入 ID
- **修复**: 移除客户端 ID，服务端用 `crypto.randomUUID()`
  ```typescript
  import { randomUUID } from 'crypto';

  // POST /files
  const id = randomUUID();
  await pool.execute('INSERT INTO files (id, user_id, ...) VALUES (?, ?, ...)', [id, req.user.id, ...]);
  ```
- **预计时间**: 1.5 小时

#### 任务 BE-12: express.json 分路由限制大小（B-Q16）
- **文件**: `api/app.ts`
- **修复**:
  ```typescript
  // 通用 body 限制
  app.use(express.json({ limit: '1mb' }));

  // 文件上传路由单独放宽
  app.use('/api/oss/upload', express.json({ limit: '50mb' }));
  app.use('/api/files/upload', express.json({ limit: '50mb' }));
  ```
- **预计时间**: 30 分钟

#### 任务 BE-13: 数据库外键约束（V17）
- **文件**: `api/database/init.ts`
- **修复**:
  ```sql
  ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  ALTER TABLE timeline_events ADD CONSTRAINT fk_timeline_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ```
- **预计时间**: 30 分钟

#### 任务 BE-14: JWT Token 过期时间缩短 + Refresh Token（V14）
- **文件**: `api/middleware/auth.ts`, `api/routes/auth.ts`
- **修复**:
  ```typescript
  // Access token: 1 小时
  const accessToken = jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });

  // Refresh token: 7 天
  const refreshToken = jwt.sign({ id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });

  // 新增 /api/auth/refresh 端点
  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    // 验证 refresh token，签发新的 access token
  });
  ```
- **预计时间**: 2 小时

#### 任务 BE-15: AI 流式响应后端（U2）
- **文件**: `api/routes/chat.ts`
- **修复**: 实现 SSE (Server-Sent Events)
  ```typescript
  router.post('/send', authMiddleware, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await callLLM(messages, { stream: true });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  });
  ```
- **预计时间**: 2-3 小时

#### 任务 BE-16: 启用 gzip 压缩（P15）
- **文件**: `api/app.ts`
- **修复**:
  ```bash
  npm install compression
  ```
  ```typescript
  import compression from 'compression';
  app.use(compression());
  ```
- **预计时间**: 15 分钟

---

### 优先级 P2 — 有空时完成（12 个）

| # | 任务 | 文件 | 预计时间 |
|---|------|------|---------|
| BE-17 | 错误消息不泄露内部信息（V11） | `api/routes/*.ts` | 1h |
| BE-18 | 输入长度统一限制策略（B-Q17） | `api/routes/*.ts` | 1h |
| BE-19 | 文件上传类型+大小限制 | `api/routes/oss.ts` | 30min |
| BE-20 | 密码强度要求提升 | `api/routes/auth.ts` | 30min |
| BE-21 | API 路由添加 input sanitization | `api/routes/*.ts` | 2h |
| BE-22 | 日志脱敏（不记录敏感数据） | `api/` 全局 | 1h |
| BE-23 | Token 黑名单/撤销机制 | 新建 `api/middleware/tokenBlacklist.ts` | 3h |
| BE-24 | API 响应缓存（ETag） | `api/app.ts` | 1h |
| BE-25 | 数据库索引优化 | `api/database/init.ts` | 1h |
| BE-26 | API 请求日志中间件 | 新建 `api/middleware/requestLogger.ts` | 30min |
| BE-27 | 健康检查端点 | 新建 `api/routes/health.ts` | 15min |
| BE-28 | API 版本化 `/api/v1/` | `api/app.ts` | 1h |

---

## 🎨 前端开发者任务清单（48 个修复）

### 优先级 P0 — 今天必须完成（10 个）

#### 任务 FE-01: 替换所有 console.error 为 Toast（U1）
- **文件**: 所有 `src/pages/*.tsx`, `src/stores/useAppStore.ts`
- **问题**: 错误仅 console.error，用户不可见
- **修复**:
  ```typescript
  // src/stores/useAppStore.ts
  import { toast } from '@/components/Toast';

  // 替换所有 .catch(console.error) 为：
  api.createFile(file).catch((err) => {
    toast.error('文件创建失败');
    console.error('createFile error:', err);
  });

  // src/pages/Files.tsx 上传失败
  .catch((err) => {
    toast.error('上传失败：' + (err.message || '网络错误'));
    console.error('Upload failed:', err);
  });
  ```
- **涉及文件清单**:
  - `src/stores/useAppStore.ts`（约 10 处）
  - `src/pages/Dashboard.tsx:146,191`
  - `src/pages/Files.tsx:107`
  - `src/pages/Chat.tsx:131,283`
  - `src/pages/SettingsPage.tsx:362`
- **预计时间**: 2 小时

#### 任务 FE-02: AI 流式响应前端（U2）
- **文件**: `src/pages/Chat.tsx:242-293`
- **问题**: 非流式，长回答体验差
- **修复**:
  ```typescript
  const handleSend = async () => {
    // 使用 EventSource 或 fetch + ReadableStream
    const response = await fetch(`${API_BASE}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, conversationId }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let aiMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          const parsed = JSON.parse(data);
          aiMessage += parsed.content;
          setMessages(prev => updateLastAIMessage(prev, aiMessage));
        }
      }
    }
  };
  ```
- **预计时间**: 2-3 小时

#### 任务 FE-03: 使用 react-markdown 渲染 AI 回复（U3）
- **文件**: `src/pages/Chat.tsx:518-546`
- **问题**: 手动解析 Markdown，代码块直接 return null
- **修复**:
  ```typescript
  import ReactMarkdown from 'react-markdown';
  import remarkGfm from 'remark-gfm';

  // 替换手动 parseMessage 函数
  const MessageContent = ({ content }: { content: string }) => (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ inline, className, children }) => (
            inline ?
              <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm">{children}</code> :
              <pre className="bg-black/40 p-4 rounded-lg overflow-x-auto">
                <code className={className}>{children}</code>
              </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
  ```
- **注意**: `react-markdown` 和 `remark-gfm` 项目已有依赖（Notes.tsx 在用）
- **预计时间**: 1 小时

#### 任务 FE-04: 修复双重认证请求（B1）
- **文件**: `src/App.tsx:35,57-74`
- **问题**: App 和 ProtectedRoute 都调用 `api.getMe()`
- **修复**:
  ```typescript
  // 方案：ProtectedRoute 不再单独请求，依赖 App 的认证状态
  function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, authLoading } = useAppStore();

    if (authLoading) return <FullScreenLoader />;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
  }

  // App.tsx 只保留一个 useEffect 检查认证
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api.getMe()
      .then((u) => setUser(u))
      .catch(() => clearAuth())
      .finally(() => setAuthLoading(false));
  }, []); // 空依赖数组，只在挂载时执行一次
  ```
- **预计时间**: 30 分钟

#### 任务 FE-05: 乐观更新回滚机制（B2）
- **文件**: `src/stores/useAppStore.ts:83-168`
- **问题**: API 失败时本地状态不一致
- **修复模式**:
  ```typescript
  removeFile: async (id: string) => {
    // 保存原始状态
    const prevFiles = get().files;
    // 乐观删除
    set({ files: prevFiles.filter(f => f.id !== id) });

    try {
      await api.deleteFile(id);
      toast.success('文件已删除');
    } catch (err) {
      // 回滚
      set({ files: prevFiles });
      toast.error('删除失败，已恢复');
      console.error('deleteFile error:', err);
    }
  },
  ```
- **需要应用到所有写操作**: addFile, removeFile, addTodo, updateTodo, toggleSubtask, deleteTodo, addNote, updateNote, deleteNote, addTimelineEvent
- **预计时间**: 2 小时

#### 任务 FE-06: Promise.allSettled 替代 Promise.all（B9）
- **文件**: `src/stores/useAppStore.ts:64-70`
- **问题**: 一个 API 失败导致全部加载失败
- **修复**:
  ```typescript
  loadData: async () => {
    if (get().loaded || !get().user) return;
    set({ loading: true });

    const results = await Promise.allSettled([
      api.getFiles(),
      api.getTodos(),
      api.getNotes(),
      api.getChatConversations(),
      api.getTimeline(),
    ]);

    const [files, todos, notes, conversations, timeline] = results.map(
      (r, i) => r.status === 'fulfilled' ? r.value : (console.error(`Load ${['files','todos','notes','conversations','timeline'][i]} failed:`, r.reason), [])
    );

    set({
      files, todos, notes,
      chatConversations: conversations,
      timeline,
      loaded: true,
      loading: false,
    });
  },
  ```
- **预计时间**: 30 分钟

#### 任务 FE-07: Chat.tsx 异步操作错误处理（B6, B7）
- **文件**: `src/pages/Chat.tsx:145-171`
- **修复**:
  ```typescript
  const refreshConversations = async () => {
    try {
      const conversations = await api.getChatConversations();
      setConversations(conversations);
    } catch (err) {
      toast.error('加载对话列表失败');
      console.error('refreshConversations error:', err);
    }
  };

  const selectConversation = async (id: string) => {
    setLoadingMessages(true);
    try {
      const messages = await api.getChatMessages({ conversationId: id });
      setChatMessages(messages);
      setActiveConversationId(id);
    } catch (err) {
      toast.error('加载消息失败');
      console.error('selectConversation error:', err);
    } finally {
      setLoadingMessages(false);
    }
  };
  ```
- **预计时间**: 1 小时

#### 任务 FE-08: Chat 切换/新建对话 loading 状态（U7）
- **文件**: `src/pages/Chat.tsx`
- **修复**: 添加 `loadingMessages` 和 `creatingConversation` 状态
  ```typescript
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  // 在消息区域显示 loading
  {loadingMessages && (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-ink-light" />
      <span className="ml-2 text-ink-light">加载消息...</span>
    </div>
  )}
  ```
- **预计时间**: 30 分钟

#### 任务 FE-09: DocxViewer XSS 修复（V10）
- **文件**: `src/components/FilePreview/DocxViewer.tsx`
- **修复**:
  ```bash
  npm install dompurify @types/dompurify
  ```
  ```typescript
  import DOMPurify from 'dompurify';

  // 渲染前清洗
  const cleanHtml = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
                   'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'a',
                   'strong', 'em', 'br', 'span', 'div', 'blockquote'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'colspan', 'rowspan'],
  });

  return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  ```
- **预计时间**: 30 分钟

#### 任务 FE-10: VideoViewer 加载/错误状态（U5）
- **文件**: `src/components/FilePreview/VideoViewer.tsx`
- **问题**: 仅 22 行，无任何状态处理
- **修复**:
  ```typescript
  export default function VideoViewer({ url, name }: Props) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
        {error && (
          <div className="text-center text-red-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>视频加载失败</p>
          </div>
        )}
        <video
          src={url}
          controls
          className="max-w-full max-h-full"
          onLoadStart={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      </div>
    );
  }
  ```
- **预计时间**: 30 分钟

---

### 优先级 P1 — 本周完成（20 个）

| # | 任务 | 文件 | 预计时间 |
|---|------|------|---------|
| FE-11 | 路由级 code splitting | `src/App.tsx` | 1h |
| FE-12 | Zustand selector 优化 | `src/stores/useAppStore.ts` + 所有页面 | 3-4h |
| FE-13 | 提取公共工具函数 | 新建 `src/lib/utils.ts` | 1h |
| FE-14 | 提取文件上传 hook | 新建 `src/hooks/useFileUpload.ts` | 1h |
| FE-15 | API 类型完善 | `src/utils/api.ts` | 2h |
| FE-16 | 长列表虚拟化 | `src/pages/Files.tsx`, `Notes.tsx` | 3h |
| FE-17 | 搜索防抖 | `src/pages/Files.tsx:65-69` | 30min |
| FE-18 | FilePreview 组件懒加载 | `src/components/FilePreview/index.tsx` | 1h |
| FE-19 | vendor chunk 细分 | `vite.config.ts` | 30min |
| FE-20 | 自定义 Confirm Dialog | 新建 `src/components/ConfirmDialog.tsx` | 1h |
| FE-21 | 替换所有 window.confirm | `Chat.tsx`, `Todos.tsx`, `Files.tsx` | 1h |
| FE-22 | ARIA 无障碍基础 | `Layout.tsx`, 所有页面 | 3h |
| FE-23 | PDF 加载进度 | `src/components/FilePreview/PDFViewer.tsx` | 1h |
| FE-24 | 图片预览拖拽平移 | `src/components/FilePreview/ImageViewer.tsx` | 1h |
| FE-25 | 缩放操作统一 | 所有 FilePreview 组件 | 1h |
| FE-26 | 上传进度条 | `src/pages/Files.tsx`, `Dashboard.tsx` | 1h |
| FE-27 | Login 实时验证 | `src/pages/Login.tsx` | 30min |
| FE-28 | Chat 移动端对话切换优化 | `src/pages/Chat.tsx:442-458` | 1h |
| FE-29 | 对话历史分页 | `src/pages/Chat.tsx` | 1h |
| FE-30 | 快速提问自动发送 | `src/pages/Chat.tsx:638-648` | 15min |

---

### 优先级 P2 — 有空时完成（18 个）

| # | 任务 | 文件 | 预计时间 |
|---|------|------|---------|
| FE-31 | 拆分 Chat.tsx 为子组件 | `src/pages/Chat.tsx` (937行) | 3h |
| FE-32 | 拆分 Notes.tsx | `src/pages/Notes.tsx` (88KB) | 3h |
| FE-33 | 拆分 Zustand Store | `src/stores/useAppStore.ts` | 2h |
| FE-34 | 提取 TodoItem 公共组件 | `src/components/TodoItem.tsx` | 1h |
| FE-35 | tsconfig 开启严格检查 | `tsconfig.json` | 30min |
| FE-36 | error 类型 any → unknown | `src/pages/*.tsx` | 1h |
| FE-37 | Files 颜色用主题色 | `src/pages/Files.tsx:35-42` | 30min |
| FE-38 | Timeline 颜色用主题色 | `src/pages/Timeline.tsx:28-46` | 30min |
| FE-39 | 移除重复 LlmSettings | `src/pages/SettingsPage.tsx:333-482` | 15min |
| FE-40 | quickDateOptions 动态计算 | `src/pages/Todos.tsx:56-61` | 15min |
| FE-41 | 空状态优化 | `Dashboard.tsx`, `Chat.tsx` | 1h |
| FE-42 | PDF 键盘翻页 | `PDFViewer.tsx` | 30min |
| FE-43 | Excel 搜索/冻结列 | `ExcelViewer.tsx` | 2h |
| FE-44 | Text 大文件虚拟滚动 | `TextViewer.tsx` | 1h |
| FE-45 | 清理重复 fetchAsArrayBuffer | 4 个 Viewer 文件 | 30min |
| FE-46 | Dashboard 统计卡片响应式 | `Dashboard.tsx` | 30min |
| FE-47 | Files 表格横滑提示 | `Files.tsx:313-394` | 15min |
| FE-48 | 对话重命名保存按钮 | `Chat.tsx:173-182` | 15min |

---

## ⚙️ 全栈/运维任务清单（18 个修复）

### 优先级 P0 — 今天完成（4 个）

#### 任务 FS-01: 前端 OSS 调用改为后端代理（配合 BE-03）
- **文件**: `src/utils/oss.ts`, `src/pages/Dashboard.tsx`, `src/pages/Files.tsx`
- **修复**: 前端不再直接操作 OSS，改为调用 `/api/oss/upload` 等
  ```typescript
  // src/utils/api.ts 新增
  export const api = {
    // ...existing
    oss: {
      upload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request('/oss/upload', { method: 'POST', body: formData, isFormData: true });
      },
      delete: (key: string) => request(`/oss/${key}`, { method: 'DELETE' }),
    },
  };

  // src/pages/Files.tsx 修改上传逻辑
  const result = await api.oss.upload(file);
  // 不再需要 OSS client
  ```
- **预计时间**: 2 小时（依赖 BE-03 完成）

#### 任务 FS-02: 前端 JWT 存储改为 cookie（配合 BE-04）
- **文件**: `src/utils/api.ts`, `src/stores/useAppStore.ts`
- **修复**:
  ```typescript
  // 移除 localStorage 存取 token 的逻辑
  // api.ts 请求自动携带 cookie（fetch credentials: 'include'）

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      credentials: 'include', // 自动携带 cookie
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    // ...
  }

  // 移除 getToken(), setToken(), clearAuth() 中的 localStorage 操作
  // Capacitor 端需要特殊处理（WebView cookie）
  ```
- **预计时间**: 1.5 小时（依赖 BE-04 完成）

#### 任务 FS-03: Electron 自定义标题栏（U10）
- **文件**: `electron/main.ts`, 新建 `src/components/TitleBar.tsx`
- **修复**:
  ```typescript
  // electron/main.ts
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false, // 无边框
    titleBarStyle: 'hidden', // 隐藏标题栏
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // preload.ts 暴露窗口控制 API
  contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    isElectron: true,
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
  });

  // main.ts 处理 IPC
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());
  ```
  ```tsx
  // src/components/TitleBar.tsx - 自定义标题栏组件
  // 需要在 Layout.tsx 顶部添加（仅 Electron 环境）
  ```
- **预计时间**: 3 小时

#### 任务 FS-04: Electron 系统托盘 + 全局快捷键 + 通知（U11, U12, U13）
- **文件**: `electron/main.ts`
- **修复**:
  ```typescript
  import { Tray, Menu, globalShortcut, Notification } from 'electron';

  // 系统托盘
  const tray = new Tray(path.join(__dirname, '../public/icon.png'));
  tray.setToolTip('Old Z - AI 知识管理');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow?.show() },
    { label: '退出', click: () => app.quit() },
  ]));

  // 全局快捷键
  globalShortcut.register('CommandOrControl+Shift+Z', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else mainWindow?.show();
  });

  // 系统通知
  function showNotification(title: string, body: string) {
    new Notification({ title, body }).show();
  }
  ```
- **预计时间**: 2 小时

---

### 优先级 P1 — 本周完成（8 个）

| # | 任务 | 文件 | 预计时间 |
|---|------|------|---------|
| FS-05 | Electron 窗口状态持久化 | `electron/main.ts` | 1h |
| FS-06 | Electron 原生菜单 | `electron/main.ts` | 1h |
| FS-07 | preload.ts 暴露更多 API | `electron/preload.ts` | 1h |
| FS-08 | Android allowBackup=false | `android/app/src/main/AndroidManifest.xml` | 5min |
| FS-09 | Android 禁用明文流量 | `AndroidManifest.xml` + `network_security_config.xml` | 30min |
| FS-10 | Capacitor 禁用 mixedContent | `capacitor.config.ts` | 5min |
| FS-11 | Vite 开发服务器 host 配置 | `vite.config.ts` | 5min |
| FS-12 | Electron 启动超时增加 | `electron/main.ts:78` | 15min |

---

### 优先级 P2 — 有空时完成（6 个）

| # | 任务 | 文件 | 预计时间 |
|---|------|------|---------|
| FS-13 | PDF.js worker 优化 | `PDFViewer.tsx` | 1h |
| FS-14 | Android Keystore 存储 token | `TokenSharePlugin.java` | 3h |
| FS-15 | Electron CSP 配置 | `electron/main.ts` | 30min |
| FS-16 | TimelineCalendar 拆分 | `src/components/TimelineCalendar.tsx` | 2h |
| FS-17 | npm audit 修复 | `package.json` | 1h |
| FS-18 | PM2 生产配置优化 | `ecosystem.config.cjs` | 30min |

---

## 📅 推荐执行计划

### Day 1（今天）— P0 严重问题

| 时间段 | 后端开发者 | 前端开发者 | 全栈/运维 |
|--------|-----------|-----------|-----------|
| 上午 | BE-01: 密码重置验证 | FE-01: Toast 替换 | FS-03: Electron 标题栏 |
| 上午 | BE-02: SSRF 防护 | FE-04: 双重认证修复 | FS-04: 托盘+快捷键 |
| 下午 | BE-03: OSS 代理 API | FE-03: react-markdown | FS-01: 前端 OSS 改造 |
| 下午 | BE-05: CORS 白名单 | FE-09: DocxViewer XSS | FS-02: 前端 JWT cookie |
| 下午 | BE-06: Helmet+RateLimit | FE-10: VideoViewer | |

### Day 2 — P0 + P1

| 时间段 | 后端开发者 | 前端开发者 | 全栈/运维 |
|--------|-----------|-----------|-----------|
| 上午 | BE-04: JWT httpOnly | FE-02: AI 流式响应 | FS-08: Android 安全 |
| 上午 | BE-07: LLM Key 后端 | FE-05: 乐观更新回滚 | FS-09: Android 明文 |
| 下午 | BE-15: AI SSE 后端 | FE-06: allSettled | FS-10: Capacitor |
| 下午 | BE-08: 错误处理中间件 | FE-07: Chat 错误处理 | FS-05: 窗口持久化 |

### Day 3 — P1 重要问题

| 时间段 | 后端开发者 | 前端开发者 | 全栈/运维 |
|--------|-----------|-----------|-----------|
| 上午 | BE-09: API 分页 | FE-11: code splitting | FS-06: 原生菜单 |
| 上午 | BE-10: todos 优化 | FE-12: Zustand selector | FS-07: preload API |
| 下午 | BE-11: 服务端 ID | FE-13: 提取工具函数 | FS-11: Vite host |
| 下午 | BE-14: Refresh Token | FE-15: API 类型 | FS-12: 启动超时 |

### Day 4-5 — P1 + P2

| 时间段 | 后端开发者 | 前端开发者 | 全栈/运维 |
|--------|-----------|-----------|-----------|
| 全天 | BE-12~BE-28 | FE-16~FE-48 | FS-13~FS-18 |
| 全天 | P2 后端优化 | P2 前端优化 | P2 运维优化 |

---

## ✅ 验收检查清单

### 安全验收（后端）
- [ ] 密码重置需要旧密码验证
- [ ] OSS 凭证不出现在前端 bundle
- [ ] JWT_SECRET 未设置时服务器拒绝启动
- [ ] SSRF 防护拒绝内网 URL
- [ ] CORS 只允许白名单域名
- [ ] Helmet 安全头生效
- [ ] 登录端点有 rate limiting
- [ ] JWT 存在 httpOnly cookie 中

### 体验验收（前端）
- [ ] 所有错误操作有 Toast 提示
- [ ] AI 回复流式输出
- [ ] Markdown 正确渲染（含代码块）
- [ ] 操作成功有 Toast 确认
- [ ] 文件预览有加载状态
- [ ] 切换对话有 loading
- [ ] window.confirm 全部替换

### 性能验收
- [ ] 首屏加载 < 1.5s
- [ ] Bundle 主 chunk < 800KB
- [ ] 100 条数据列表不卡顿
- [ ] 搜索输入流畅

### 桌面端验收
- [ ] 自定义标题栏（Electron）
- [ ] 系统托盘功能
- [ ] 全局快捷键工作
- [ ] 系统通知推送

---

## 📁 参考文档

| 文档 | 路径 | 内容 |
|------|------|------|
| 综合审查报告 | `ai/memory-bank/progress/COMPREHENSIVE-REVIEW-REPORT.md` | 97 个问题详细分析 |
| 批量修复报告 Part1 | `ai/memory-bank/progress/BATCH-FIX-REPORT-PART1.md` | 修复 1-33 详细代码 |
| 批量修复报告 Part2 | `ai/memory-bank/progress/BATCH-FIX-REPORT-PART2.md` | 修复 34-97 详细代码 |
| 本任务分配指南 | `ai/memory-bank/progress/TEAM-TASK-ASSIGNMENT.md` | 本文 |

---

**开始执行吧！如有任何修复步骤不清楚，随时问我。** 🚀
