import { registerPlugin } from '@capacitor/core';

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
  // Only set Content-Type for requests with a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });
  } catch (fetchErr: any) {
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
  register: (username: string, password: string, displayName?: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () =>
    request<{ id: string; username: string; displayName: string }>('/auth/me'),
  resetPassword: (username: string, newPassword: string) =>
    request<{ token: string; user: { id: string; username: string; displayName: string } }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ username, newPassword }) }),

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
  createNote: (note: any) => request<any>('/notes', { method: 'POST', body: JSON.stringify(note) }),
  updateNote: (id: string, updates: any) => request<void>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteNote: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),

  // Chat
  getChatMessages: () => request<any[]>('/chat'),
  chat: (content: string) => request<{ userMessage: any; aiMessage: any }>('/chat', { method: 'POST', body: JSON.stringify({ content }) }),

  // Timeline
  getTimeline: () => request<any[]>('/timeline'),
  createTimelineEvent: (event: any) => request<any>('/timeline', { method: 'POST', body: JSON.stringify(event) }),

  // QuantLife
  quantlife: {
    getProgress: () => request<any>('/quantlife/progress'),
    saveProgress: (data: any) => request<any>('/quantlife/progress', { method: 'POST', body: JSON.stringify(data) }),
    getLlmConfig: () => request<any>('/quantlife/llm-config'),
    saveLlmConfig: (config: any) => request<any>('/quantlife/llm-config', { method: 'POST', body: JSON.stringify(config) }),
    ingestText: (date: string, text: string, hintDimensionKey?: string) =>
      request<any>('/quantlife/ingest/text', { method: 'POST', body: JSON.stringify({ date, text, hint_dimension_key: hintDimensionKey }) }),
    planDirection: (goal: string, context: string, stages: any[]) =>
      request<any>('/quantlife/plan/direction', { method: 'POST', body: JSON.stringify({ goal, context, stages }) }),
    health: () => request<any>('/quantlife/health'),
  },
};
