# Old Z 项目 - 批量修复报告（方案 B）

**生成时间**: 2026-07-07 10:22  
**总问题数**: 97 个  
**预计总工作量**: 3-5 天（2-3 人并行）  

---

## 📋 修复优先级总览

| 优先级 | 问题数 | 预计工作量 | 建议顺序 |
|---------|--------|--------------|-----------|
| **P0 - 严重** | 25 个 | 1-2 天 | 第一批 |
| **P1 - 重要** | 36 个 | 1-2 天 | 第二批 |
| **P2 - 优化** | 36 个 | 1 天 | 第三批 |

---

## 一、P0 严重问题修复（25 个）

### 🔒 安全漏洞（4 个）

---

#### ✅ 修复 1/97: JWT Secret 硬编码（V3）— ✅ 已完成

**文件**: `api/middleware/auth.ts:4`  
**状态**: ✅ 已完成  

**修复后的代码**:
```typescript
// api/middleware/auth.ts
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is required');
  console.error('Please set JWT_SECRET in your .env file');
  process.exit(1);
}
```

**验证**: 重启服务器，如果未设置 `JWT_SECRET`，应看到错误信息并退出。

---

#### ✅ 修复 2/97: OSS 配置日志泄露（B5）— ✅ 已完成

**文件**: `src/utils/oss.ts:13-20`  
**状态**: ✅ 已完成  

**修复后的代码**:
```typescript
// src/utils/oss.ts
const ossConfig = {
  region: import.meta.env.VITE_OSS_REGION || 'oss-cn-beijing',
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID || '',
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET || '',
  bucket: import.meta.env.VITE_OSS_BUCKET || 'oldzz',
};

// 生产环境不允许在前端配置 OSS 凭证
if (import.meta.env.MODE === 'production') {
  console.warn('WARNING: OSS credentials should be moved to backend API for production use');
}
```

**下一步（P0 关键）**: 创建后端 OSS 代理 API，完全移除前端的 `VITE_OSS_` 环境变量。

---

#### 🔄 修复 3/97: 密码重置无需验证（V1）— 50% 完成

**文件**: `api/routes/auth.ts:129-180`  
**状态**: 🔄 部分完成（已添加 `oldPassword` 参数，但验证逻辑不完整）  

**当前代码**（已部分修复）:
```typescript
router.post('/reset-password', async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    
    if (!oldPassword || typeof oldPassword !== 'string') {
      res.status(400).json({ success: false, error: '请输入旧密码' });
      return;
    }
    
    // ❌ 这里缺少验证 oldPassword 的逻辑
    const [rows] = await pool.execute('SELECT id, username FROM users WHERE username = ?', [username]);
    // ...
```

**需要补充的代码**:
```typescript
    // 检查用户是否存在并验证旧密码
    const [rows] = await pool.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ?', 
      [username]
    );
    const users = rows as any[];

    if (users.length === 0) {
      // 不透露用户是否存在（安全最佳实践）
      res.status(200).json({ 
        success: true, 
        data: { message: '如果用户存在，密码已重置' } 
      });
      return;
    }

    const user = users[0];
    const valid = await bcrypt.compare(oldPassword, user.password_hash);

    if (!valid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    // 继续密码重置逻辑...
```

**验证**: 
1. 尝试用错误旧密码重置 → 应返回 401
2. 尝试用正确旧密码重置 → 应成功
3. 尝试重置不存在的用户 → 应返回 200（但不实际重置）

---

#### 🔄 修复 4/97: SSRF 风险（V4）

**文件**: `api/services/settings.ts`  
**问题**: 用户可自定义 `balance_url`，指向内网地址  

**修复步骤**:

1. 创建 URL 验证函数：
```typescript
// api/services/settings.ts
import { URL } from 'url';

function isSSRFSeafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // 解析域名到 IP
    const dns = require('dns').promises;
    const addresses = await dns.resolve(parsed.hostname);
    
    // 检查是否为私有 IP
    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        return false;
      }
    }
    
    // 白名单域名（可选）
    const allowedDomains = [
      'api.openai.com',
      'generativelanguage.googleapis.com',
      'api.anthropic.com',
      // 添加你的 LLM 服务商域名
    ];
    
    if (!allowedDomains.includes(parsed.hostname)) {
      console.warn(`SSRF Warning: LLM balance URL not in whitelist: ${parsed.hostname}`);
      // 你可以选择阻止或只允许白名单
    }
    
    return true;
  } catch {
    return false;
  }
}

function isPrivateIP(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('172.') && 
      parseInt(ip.split('.')[1]) >= 16 && 
      parseInt(ip.split('.')[1]) <= 31 ||
    ip.startsWith('192.168.') ||
    ip === '127.0.0.1' ||
    ip === '::1'
  );
}
```

2. 在 `fetchLlmBalance` 中使用：
```typescript
// api/services/settings.ts
export async function fetchLlmBalance(config: LlmConfig): Promise<number> {
  if (!config.balance_url) {
    return 0;
  }
  
  // ✅ 添加 SSRF 检查
  if (!isSSRFSeafe(config.balance_url)) {
    console.error('SSRF detected: Invalid balance_url', config.balance_url);
    return 0;
  }
  
  // 继续原有逻辑...
}
```

**验证**: 
1. 设置 `balance_url` 为 `http://127.0.0.1:3306` → 应返回 0 且不发起请求
2. 设置 `balance_url` 为 `https://api.openai.com` → 应正常工作

---

### 🐛 代码质量 Bug（5 个）

---

#### 🔄 修复 5/97: 双重认证请求 Race Condition（B1）

**文件**: `src/App.tsx:21-35` 和 `src/App.tsx:57-74`  
**问题**: `ProtectedRoute` 和 `App` 都调用 `api.getMe()`，导致重复请求  

**修复步骤**:

1. **移除 `ProtectedRoute` 的认证检查**（让 `App` 统一处理）：
```tsx
// src/App.tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore();
  // ✅ 移除 loading 状态和 api.getMe() 调用
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

2. **简化 `App` 的认证逻辑**：
```tsx
export default function App() {
  useTheme();
  const { user, setUser } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    
    // ✅ 只调用一次 getMe()
    api.getMe()
      .then(u => { setUser(u); })
      .catch(() => { clearAuth(); clearNativeToken(); })
      .finally(() => { setAuthChecked(true); });
  }, []); // ✅ 添加空依赖数组，只运行一次

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-950">
        <div className="text-parchment-100 text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        {/* ... */}
      </Router>
    </ToastProvider>
  );
}
```

**验证**: 
1. 打开浏览器开发者工具 → Network 标签
2. 刷新页面
3. 应只看到 **1 次** `/api/auth/me` 请求

---

#### 🔄 修复 6/97: 乐观更新无回滚机制（B2）

**文件**: `src/stores/useAppStore.ts:83-168`  
**问题**: API 失败时本地状态与服务器不一致  

**修复步骤**（以 `addFile` 为例）:

```typescript
// src/stores/useAppStore.ts
addFile: (file) => {
  // ✅ 先乐观更新
  set((s) => ({ files: [file, ...s.files] }));
    
  // ✅ API 调用失败时回滚
  api.createFile(file)
    .catch((error) => {
      console.error('Failed to create file:', error);
      // 回滚：从列表中移除
      set((s) => ({ 
        files: s.files.filter((f) => f.id !== file.id) 
      }));
      // ✅ 显示错误 Toast（需要先集成 Toast 系统）
      const { showToast } = useToast();
      showToast('error', '文件创建失败，已撤销');
    });
},
```

**对所有写操作重复此模式**：`removeFile`, `addTodo`, `updateTodo`, `deleteTodo`, `addNote`, `updateNote`, `deleteNote`

**验证**: 
1. 断开网络
2. 尝试上传文件
3. 应看到文件短暂出现在列表，然后被移除 + 错误 Toast

---

#### 🔄 修复 7/97: loadData 使用 Promise.all（B8）

**文件**: `src/stores/useAppStore.ts:61-78`  
**问题**: 一个请求失败导致全部数据加载失败  

**修复步骤**:

```typescript
// src/stores/useAppStore.ts
loadData: async () => {
  if (get().loaded || !get().user) return;
  try {
    // ✅ 使用 Promise.allSettled 替代 Promise.all
    const results = await Promise.allSettled([
      api.getFiles(),
      api.getTodos(),
      api.getNotes(),
      api.getChatConversations(),
      api.getTimeline(),
    ]);

    // ✅ 提取成功的结果，失败的数据显示错误
    const [filesResult, todosResult, notesResult, conversationsResult, timelineResult] = results;

    const files = filesResult.status === 'fulfilled' ? filesResult.value : [];
    const todos = todosResult.status === 'fulfilled' ? todosResult.value : [];
    const notes = notesResult.status === 'fulfilled' ? notesResult.value : [];
    const chatConversations = conversationsResult.status === 'fulfilled' ? conversationsResult.value : [];
    const timeline = timelineResult.status === 'fulfilled' ? timelineResult.value : [];

    // ✅ 记录失败的请求
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['files', 'todos', 'notes', 'conversations', 'timeline'];
        console.error(`Failed to load ${names[index]}:`, result.reason);
      }
    });

    const activeConversationId = chatConversations[0]?.id || null;
    const chatMessages = activeConversationId 
      ? await api.getChatMessages({ conversationId: activeConversationId }).catch(() => [])
      : [];

    set({ 
      files, todos, notes, chatMessages, chatConversations, 
      activeConversationId, timeline, loaded: true 
    });
  } catch (error) {
    console.error('Failed to load data:', error);
    set({ loaded: false });
  }
},
```

**验证**: 
1. 模拟 API 失败（如停止后端服务器）
2. 刷新页面
3. 应看到部分数据加载成功，而非全部失败

---

#### 🔄 修复 8/97: useEffect 依赖数组不完整（B12）

**文件**: `src/App.tsx:21`, `src/pages/*.tsx` 多个文件  
**问题**: React 警告 missing dependencies  

**修复步骤**:

1. 运行 ESLint 检查依赖：
```bash
cd D:\code\oldz
npx eslint src/App.tsx --fix
```

2. 手动修复常见模式：
```tsx
// ❌ 错误
useEffect(() => {
  if (user) {
    setLoading(false);
  }
}, []); // React 警告：user 应在依赖中

// ✅ 正确
useEffect(() => {
  if (user) {
    setLoading(false);
  }
}, [user]); // 添加依赖
```

**注意**: 如果依赖会导致无限循环，使用 `useCallback` 或 `useMemo` 包装函数。

---

#### 🔄 修复 9/97: 客户端生成 ID 与服务器冲突（B9）

**文件**: `src/pages/Notes.tsx`  
**问题**: `id: note-ai-${Date.now()}-${index}` 格式与服务器无关  

**修复步骤**:

1. **前端不再生成 ID**，让服务器生成：
```typescript
// src/pages/Notes.tsx
const handleSaveNote = async () => {
  const noteData = {
    // ❌ 移除 id 字段
    // id: `note-${Date.now()}`,
    title: noteTitle,
    content: noteContent,
    // ...
  };

  const savedNote = await api.createNote(noteData);
  
  // ✅ 使用服务器返回的 ID
  setNotes((prev) => [...prev, savedNote]);
};
```

2. **后端确保生成 UUID**（如果尚未实现）：
```typescript
// api/routes/notes.ts
router.post('/', authMiddleware, async (req, res) => {
  try {
    const id = crypto.randomUUID(); // ✅ 服务器生成 ID
    const { title, content, ... } = req.body;
    
    await pool.execute(
      'INSERT INTO notes (id, user_id, title, content, ...) VALUES (?, ?, ?, ?, ...)',
      [id, req.userId!, title, content, ...]
    );
    
    res.status(201).json({ success: true, data: { id, ... } });
  } catch (error) {
    // ...
  }
});
```

---

### 🎨 用户体验 P0 问题（13 个）

---

#### ✅ 修复 10/97: Toast 通知系统（U1）— ✅ 已完成

**文件**: 
- ✅ 已创建 `src/components/Toast.tsx`
- ✅ 已集成到 `src/App.tsx`
- ✅ 已添加 CSS 动画

**下一步**: 在所有 `.catch(console.error)` 处调用 `showToast()`

**使用示例**:
```tsx
import { useToast } from '@/components/Toast';

function MyComponent() {
  const { showToast } = useToast();
  
  const handleSave = async () => {
    try {
      await api.saveData();
      showToast('success', '保存成功');
    } catch (error) {
      showToast('error', '保存失败：' + error.message);
    }
  };
}
```

---

#### 🔄 修复 11/97: AI 对话非流式响应（U2）

**文件**: 
- `api/services/llmRequest.ts`
- `src/pages/Chat.tsx`

**修复步骤**（复杂，建议单独任务）:

1. **后端改为 SSE（Server-Sent Events）**:
```typescript
// api/services/llmRequest.ts
export async function* streamLlmResponse(config: LlmConfig, messages: Message[]): AsyncGenerator<string> {
  const response = await fetch(`${config.base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true, // ✅ 启用流式
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        const content = data.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    }
  }
}
```

2. **前端逐字渲染**:
```tsx
// src/pages/Chat.tsx
const handleSend = async () => {
  const userMessage = { role: 'user', content: input };
  setChatMessages((prev) => [...prev, userMessage]);
  setInput('');

  // ✅ 创建空的 AI 回复消息
  const aiMessageId = `msg-${Date.now()}`;
  setChatMessages((prev) => [...prev, { id: aiMessageId, role: 'assistant', content: '' }]);

  // ✅ 流式更新内容
  for await (const chunk of api.chat.stream(userMessage)) {
    setChatMessages((prev) => 
      prev.map((msg) => 
        msg.id === aiMessageId 
          ? { ...msg, content: msg.content + chunk }
          : msg
      )
    );
  }
};
```

**工作量**: 6-8 小时  
**验证**: AI 回复应逐字显示，而非一次性全部出现

---

#### 🔄 修复 12/97: Markdown 渲染不完整（U3）

**文件**: `src/pages/Chat.tsx:518-546`  
**问题**: 代码块直接 `return null`，不支持链接、图片等  

**修复步骤**:

1. **安装 `react-markdown`**（如果尚未安装）:
```bash
cd D:\code\oldz
npm install react-markdown remark-gfm
```

2. **替换手动 Markdown 解析为组件**:
```tsx
// src/pages/Chat.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ✅ 替换原有的 renderMarkdown 函数
function renderMessage(content: string) {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      className="prose-notes"
    >
      {content}
    </ReactMarkdown>
  );
}

// 在消息渲染中使用
{messages.map((msg) => (
  <div key={msg.id} className={`message ${msg.role}`}>
    {renderMessage(msg.content)}
  </div>
))}
```

**验证**: 
1. 发送包含代码块的消息给 AI
2. 应看到代码块正确渲染（而非空白）

---

#### 🔄 修复 13-22/97: ARIA 无障碍缺失（U4）

**文件**: 所有页面和组件  

**修复步骤**（可并行）:

1. **所有按钮添加 `aria-label`**:
```tsx
// ❌ 错误
<button onClick={handleDelete}>
  <Trash2 className="w-4 h-4" />
</button>

// ✅ 正确
<button 
  onClick={handleDelete}
  aria-label="删除待办"
>
  <Trash2 className="w-4 h-4" />
</button>
```

2. **对话框添加 `role="dialog"`**:
```tsx
// src/components/FilePreview/index.tsx
<div 
  className="modal-overlay"
  role="dialog" // ✅ 添加
  aria-modal="true" // ✅ 添加
  aria-labelledby="dialog-title" // ✅ 添加
>
  {/* ... */}
</div>
```

3. **导航添加 `role="navigation"`**:
```tsx
// src/components/Layout.tsx
<nav role="navigation" aria-label="主导航">
  {/* ... */}
</nav>
```

**工具**: 使用 `axe DevTools`（浏览器扩展）自动检测 ARIA 问题

---

#### 🔄 修复 23-33/97: 其他 P0 UX 问题

由于报告已很长，我在文件中继续列出所有修复步骤...

**完整修复步骤见下一部分**（我继续生成到 97 个）

---

## 二、需要继续生成的内容

报告已生成长达 **300+ 行**。继续生成剩余 67 个问题的修复步骤...

让我保存当前进度并继续：
