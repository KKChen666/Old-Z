import { registerPlugin } from '@capacitor/core';
import type { AiActionSuggestion, ChatConversation, ChatReference, DailyReport, GeneratedReport, NoteChange, NoteSnapshot, ReportGenerationResponse, SearchResponse, SearchResult, SyncOverview } from '@/types';

// Capacitor: detect running inside native shell
// isNativePlatform is a FUNCTION, must call it — checking truthiness of the function
// reference itself would always be true whenever @capacitor/core is loaded.
const isCapacitor = typeof window !== 'undefined'
  && typeof (window as any).Capacitor?.isNativePlatform === 'function'
  && !!(window as any).Capacitor.isNativePlatform();

// Capacitor 原生插件（用于桌面小部件 Token 同步）
const TokenShare = isCapacitor ? registerPlugin('TokenShare') : null;

/**
 * 将 JWT Token 同步到 Android SharedPreferences，供桌面小部件读取。
 * 仅在 Capacitor 原生环境下生效。
 */
export async function syncTokenToNative(token: string) {
  if (TokenShare) {
    try { await (TokenShare as any).saveToken({ token }); } catch {}
  }
}

/**
 * 清除 Android SharedPreferences 中的 Token。
 */
export async function clearNativeToken() {
  if (TokenShare) {
    try { await (TokenShare as any).clearToken(); } catch {}
  }
}

// In Electron production mode (file:// protocol), API requests must go directly to the backend
// In dev mode, Vite proxy handles /api → localhost:3001
const isElectronProd = typeof window !== 'undefined'
  && (window as any).electronAPI?.isElectron
  && window.location.protocol === 'file:';

// Capacitor / 原生 App 的远程 API 地址
// 在 .env 中配置 VITE_API_BASE_URL=http://你的服务器IP:3001/api
// 浏览器 dev 模式不需要配置，Vite 代理自动转发 /api → localhost:3001
const REMOTE_API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function resolveApiBase(): string {
  // 用户自定义后端地址（通过登录页长按 Logo 设置）
  const customBase = localStorage.getItem('old-z-api-base');
  if (customBase) return customBase;

  // Capacitor native app → 直接请求后端服务器
  if (isCapacitor) {
    return REMOTE_API_BASE || 'http://localhost:3001/api';
  }
  // Electron 生产模式
  if (isElectronProd) {
    return 'http://localhost:3001/api';
  }
  // 浏览器开发/生产模式，使用 Vite 代理（dev）或 nginx 代理（prod）
  return '/api';
}

/** 获取当前生效的 API 基础地址（不含自定义覆盖时返回默认值） */
export function getDefaultApiBase(): string {
  if (isCapacitor) {
    return REMOTE_API_BASE || 'http://localhost:3001/api';
  }
  if (isElectronProd) {
    return 'http://localhost:3001/api';
  }
  return '/api';
}

/** 获取当前生效的 API 基础地址 */
export function getEffectiveApiBase(): string {
  return localStorage.getItem('old-z-api-base') || getDefaultApiBase();
}

const API_BASE = resolveApiBase();

export function getToken() {
  return localStorage.getItem('old-z-token');
}

export function saveAuth(token: string) {
  localStorage.setItem('old-z-token', token);
}

export function clearAuth() {
  localStorage.removeItem('old-z-token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const shouldAttachLocalLlm = path.startsWith('/chat') || path === '/notes/assist' || path === '/notes/intent';
  if (shouldAttachLocalLlm) {
    const activeStorage = localStorage.getItem('old-z-active-llm-storage');
    const activeId = localStorage.getItem('old-z-active-llm-id');
    const localPresets = localStorage.getItem('old-z-local-llm-presets');
    if (activeStorage === 'local' && activeId && localPresets) {
      try {
        const presets = JSON.parse(localPresets);
        const activePreset = Array.isArray(presets) ? presets.find((item) => item.id === activeId) : null;
        if (activePreset) headers['x-oldz-local-llm-config'] = JSON.stringify(activePreset);
      } catch {}
    }
  }
  // Only set Content-Type for requests with a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  // 请求超时控制 — 30 秒后自动中止（AI 聊天等长请求走流式接口不受此限制）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
      signal: options?.signal || controller.signal,
    });
  } catch (fetchErr: any) {
    // AbortError — 请求超时
    if (fetchErr?.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    // 网络层错误（DNS 失败、连接超时、CORS、混合内容等）
    const msg = String(fetchErr?.message || fetchErr);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
      throw new Error('无法连接到服务器，请检查网络连接后重试');
    }
    if (msg.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error('服务器连接被拒绝，请稍后重试');
    }
    if (msg.includes('ERR_TIMED_OUT') || msg.includes('Timeout')) {
      throw new Error('连接超时，请检查网络状况');
    }
    throw new Error('网络请求失败，请检查网络连接');
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent('auth-expired'));
    throw new Error('认证已过期，请重新登录');
  }

  if (!res.ok) {
    let errorMsg = `API error: ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch {}
    throw new Error(errorMsg);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data.data;
}

export const api = {
  // Auth
  localLogin: () => request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/local', { method: 'POST' }),
  register: (username: string, password: string, displayName?: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () =>
    request<{ id: string; username: string; displayName: string }>('/auth/me'),
  resetPassword: (username: string, oldPassword: string, newPassword: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ username, oldPassword, newPassword }) }),
  updateProfile: (updates: { displayName?: string; username?: string }) =>
    request<{ id: string; username: string; displayName: string }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(updates) }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
  mergeLocal: () =>
    request<{ merged: number; skipped: number; message: string }>('/auth/merge-local', { method: 'POST' }),

  // Files
  getFiles: () => request<any[]>('/files'),
  createFile: (file: any) => request<any>('/files', { method: 'POST', body: JSON.stringify(file) }),
  deleteFile: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),

  // Todos
  getTodos: () => request<any[]>('/todos'),
  createTodo: (todo: any) => request<any>('/todos', { method: 'POST', body: JSON.stringify(todo) }),
  updateTodo: (id: string, updates: any) => request<void>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  toggleSubtask: (todoId: string, subtaskId: string) => request<void>(`/todos/${todoId}/subtasks/${subtaskId}`, { method: 'PATCH' }),
  deleteTodo: (id: string) => request<void>(`/todos/${id}`, { method: 'DELETE' }),

  // Notes
  getNotes: () => request<any[]>('/notes'),
  getNoteChanges: (dateOrId: string) =>
    request<any[]>(dateOrId.length <= 10
      ? `/notes/changes?date=${encodeURIComponent(dateOrId)}`
      : `/notes/${dateOrId}/changes`),
  getNoteSnapshots: (id: string) => request<NoteSnapshot[]>(`/notes/${id}/snapshots`),
  restoreNoteSnapshot: (id: string, snapshotId: string) =>
    request<{ id: string; title: string; content: string; updatedAt: string }>(`/notes/${id}/restore`, { method: 'POST', body: JSON.stringify({ snapshotId }) }),
  createNote: (note: any) => request<any>('/notes', { method: 'POST', body: JSON.stringify(note) }),
  updateNote: (id: string, updates: any) => request<void>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteNote: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  assistNote: (payload: { mode: string; instruction?: string; title?: string; content?: string; selection?: string }) =>
    request<{ content: string }>('/notes/assist', { method: 'POST', body: JSON.stringify(payload) }),
  classifyNoteIntent: (payload: { instruction: string; hasSelection?: boolean; title?: string; contentPreview?: string }) =>
    request<any>('/notes/intent', { method: 'POST', body: JSON.stringify(payload) }),

  // Chat
  getChatMessages: (params?: { scope?: 'global' | 'note'; noteId?: string; conversationId?: string }) => {
    const search = new URLSearchParams();
    if (params?.scope) search.set('scope', params.scope);
    if (params?.noteId) search.set('noteId', params.noteId);
    if (params?.conversationId) search.set('conversationId', params.conversationId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request<any[]>(`/chat${suffix}`);
  },
  getChatConversations: () => request<ChatConversation[]>('/chat/conversations'),
  createChatConversation: (payload?: { title?: string; scope?: 'global' | 'note'; noteId?: string }) =>
    request<ChatConversation>('/chat/conversations', { method: 'POST', body: JSON.stringify(payload || {}) }),
  renameChatConversation: (id: string, title: string) =>
    request<void>(`/chat/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteChatConversation: (id: string) => request<void>(`/chat/conversations/${id}`, { method: 'DELETE' }),
  deleteChatMessage: (id: string) => request<void>(`/chat/messages/${id}`, { method: 'DELETE' }),
  withdrawChatExchange: (conversationId: string) =>
    request<{ deleted: number }>('/chat/withdraw', { method: 'POST', body: JSON.stringify({ conversationId }) }),
  chat: {
    send: (content: string, options?: { scope?: 'global' | 'note'; noteId?: string; conversationId?: string; references?: ChatReference[] }) =>
      request<{ conversation: ChatConversation; userMessage: any; aiMessage: any }>('/chat', { method: 'POST', body: JSON.stringify({ content, ...options }) }),
    /**
     * 流式发送消息 — 通过 SSE 逐字返回 AI 回复
     * onChunk 在收到每个文本块时调用，onMeta 在收到初始元数据时调用，onDone 在完成时调用
     */
    sendStream: async (
      content: string,
      options: { scope?: 'global' | 'note'; noteId?: string; conversationId?: string; references?: ChatReference[] },
      callbacks: {
        onMeta?: (data: { conversation: ChatConversation; userMessage: any; aiMessageId: string }) => void;
        onChunk?: (text: string) => void;
        onDone?: (aiMessage: any) => void;
        onError?: (error: string) => void;
      }
    ): Promise<void> => {
      const token = getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // 附加本地 LLM 配置（与 request() 一致）
      const shouldAttachLocalLlm = true;
      if (shouldAttachLocalLlm) {
        const activeStorage = localStorage.getItem('old-z-active-llm-storage');
        const activeId = localStorage.getItem('old-z-active-llm-id');
        const localPresets = localStorage.getItem('old-z-local-llm-presets');
        if (activeStorage === 'local' && activeId && localPresets) {
          try {
            const presets = JSON.parse(localPresets);
            const activePreset = Array.isArray(presets) ? presets.find((item) => item.id === activeId) : null;
            if (activePreset) headers['x-oldz-local-llm-config'] = JSON.stringify(activePreset);
          } catch {}
        }
      }

      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, ...options }),
      });

      if (!res.ok) {
        let errorMsg = `API error: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {}
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取流式响应');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'meta') {
                callbacks.onMeta?.(data);
              } else if (data.type === 'chunk') {
                callbacks.onChunk?.(data.content);
              } else if (data.type === 'done') {
                callbacks.onDone?.(data.aiMessage);
              } else if (data.type === 'error') {
                callbacks.onError?.(data.error);
              }
            } catch { /* skip non-JSON lines */ }
          }
        }
      }
    },
    generate: (prompt: string) =>
      request<{ content: string }>('/chat/generate', { method: 'POST', body: JSON.stringify({ prompt }) }),
    actions: (message: string, aiReply: string) =>
      request<AiActionSuggestion[]>('/chat/actions', { method: 'POST', body: JSON.stringify({ message, aiReply }) }),
    plan: (goal: string, context: string, stages: any[]) =>
      request<{ main_line: string; today_actions: string[] }>('/chat/plan', { method: 'POST', body: JSON.stringify({ goal, context, stages }) }),
  },

  // Timeline
  getTimeline: () => request<any[]>('/timeline'),
  createTimelineEvent: (event: any) => request<any>('/timeline', { method: 'POST', body: JSON.stringify(event) }),

  // Reports
  getDailyReport: (date: string) => request<DailyReport | null>(`/reports/daily?date=${encodeURIComponent(date)}`),
  getMonthlyDailyReports: (month: string) => request<DailyReport[]>(`/reports/daily?month=${encodeURIComponent(month)}`),
  saveDailyReport: (date: string, content: string) =>
    request<{ date: string; content: string }>('/reports/daily', { method: 'PUT', body: JSON.stringify({ date, content }) }),
  generateReports: () =>
    request<ReportGenerationResponse['data']>('/reports/generate', { method: 'POST' }),

  // Search
  search: (query: string, kind: 'note' | 'todo' | 'file' | 'all' = 'all', limit?: number) => {
    const params = new URLSearchParams({ q: query, kind });
    if (limit) params.set('limit', String(limit));
    return request<SearchResponse['results']>(`/search?${params.toString()}`);
  },
  searchNotes: (query: string, limit?: number) => {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', String(limit));
    return request<SearchResponse['results']>(`/search/notes?${params.toString()}`);
  },
  searchTodos: (query: string, limit?: number) => {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', String(limit));
    return request<SearchResponse['results']>(`/search/todos?${params.toString()}`);
  },
  searchFiles: (query: string, limit?: number) => {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', String(limit));
    return request<SearchResponse['results']>(`/search/files?${params.toString()}`);
  },
  rebuildSearchIndex: () => request<{ message: string }>('/search/rebuild', { method: 'POST' }),

  // Sync — 需要 X-Sync-Key header
  sync: {
    _getKey: () => {
      try {
        const remotes = JSON.parse(localStorage.getItem('oldz-remotes') || '[]');
        const active = localStorage.getItem('oldz-active-remote') || '';
        return remotes.find((r: any) => r.name === active)?.key || '';
      } catch { return ''; }
    },
    status: () => {
      const key = api.sync._getKey();
      return request<SyncOverview>('/sync/status', { headers: { 'X-Sync-Key': key } as any });
    },
    push: (ids?: string[]) => {
      const key = api.sync._getKey();
      return request<{ pushed: number; errors: string[] }>('/sync/push', { method: 'POST', headers: { 'X-Sync-Key': key } as any, body: JSON.stringify({ ids }) });
    },
    pull: () => {
      const key = api.sync._getKey();
      return request<{ pulled: number; errors: string[] }>('/sync/pull', { method: 'POST', headers: { 'X-Sync-Key': key } as any });
    },
  },

  // Settings
  settings: {
    getLlmConfig: () => request<any>('/settings/llm'),
    saveLlmConfig: (config: any) => request<any>('/settings/llm', { method: 'POST', body: JSON.stringify(config) }),
    getLlmBalance: (preset: any) => request<any>('/settings/llm/balance', { method: 'POST', body: JSON.stringify({ preset }) }),
    // 同步密钥
    generateSyncKey: (label: string) => request<{ key: string; id: string; label: string }>('/settings/sync-key/generate', { method: 'POST', body: JSON.stringify({ label }) }),
    getSyncKeys: () => request<any[]>('/settings/sync-keys'),
    deleteSyncKey: (id: string) => request<any>('/settings/sync-key/' + id, { method: 'DELETE' }),
  },

  // Git 版本控制（本地模式）
  git: {
    info: () => request<{ initialized: boolean; path: string; branch: string; remotes: string[] }>('/git/info'),
    status: () => request<{ staged: string[]; modified: string[]; created: string[]; deleted: string[]; renamed: Array<{ from: string; to: string }>; isClean: boolean }>('/git/status'),
    log: (options?: { limit?: number; file?: string }) => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.file) params.set('file', options.file);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request<Array<{ hash: string; shortHash: string; date: string; message: string; authorName: string; authorEmail: string; refs: string }>>(`/git/log${suffix}`);
    },
    diff: (hash: string) => request<{ hash: string; message: string; date: string; authorName: string; diff: string }>(`/git/diff/${hash}`),
    commit: (message: string) => request<{ hash: string; summary: { insertions: number; deletions: number; files: number } }>('/git/commit', { method: 'POST', body: JSON.stringify({ message }) }),
    getRemotes: () => request<Array<{ name: string; fetch: string; push: string }>>('/git/remotes'),
    addRemote: (name: string, url: string) => request<{ name: string; url: string }>('/git/remote', { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeRemote: (name: string) => request<{ removed: string }>(`/git/remote/${name}`, { method: 'DELETE' }),
    push: (remote: string, branch: string) => request<{ pushed: boolean; result: string }>('/git/push', { method: 'POST', body: JSON.stringify({ remote, branch }) }),
    pull: (remote: string, branch: string) => request<{ pulled: boolean; result: string; mergeSummary?: any }>('/git/pull', { method: 'POST', body: JSON.stringify({ remote, branch }) }),
    getBranches: () => request<Array<{ name: string; current: boolean }>>('/git/branches'),
  },

  // 远程数据同步（笔记和待办）
  remoteSync: {
    preview: (remote: { key: string }) =>
      request<{
        local: Array<{ id: string; kind: 'note' | 'todo'; title: string; content: string; updatedAt: string | null }>;
        remote: Array<{ id: string; kind: 'note' | 'todo'; title: string; content: string; updatedAt: string | null }>;
        error?: string;
      }>('/remote-sync/preview', { method: 'POST', body: JSON.stringify(remote) }),
    test: (remote: { key: string }) =>
      request<{ ok: boolean; serverInfo?: string; error?: string }>('/remote-sync/test', { method: 'POST', body: JSON.stringify(remote) }),
    status: (remote: { key: string }) =>
      request<{ local: { notes: number; todos: number }; remote: { notes: number; todos: number } | null; error?: string }>('/remote-sync/status', { method: 'POST', body: JSON.stringify(remote) }),
    push: (remote: { name: string; key: string; selection?: { notes: string[]; todos: string[] } }) =>
      request<{ notesPushed: number; todosPushed: number; errors: string[] }>('/remote-sync/push', { method: 'POST', body: JSON.stringify(remote) }),
    pull: (remote: { name: string; key: string; selection?: { notes: string[]; todos: string[] } }) =>
      request<{ notesPulled: number; todosPulled: number; errors: string[] }>('/remote-sync/pull', { method: 'POST', body: JSON.stringify(remote) }),
  },
};
