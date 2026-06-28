// Capacitor: detect running inside native shell
const isCapacitor = typeof window !== 'undefined'
  && !!(window as any).Capacitor?.isNativePlatform;

// In Electron production mode (file:// protocol), API requests must go directly to the backend
// In dev mode, Vite proxy handles /api → localhost:3001
const isElectronProd = typeof window !== 'undefined'
  && (window as any).electronAPI?.isElectron
  && window.location.protocol === 'file:';

function resolveApiBase(): string {
  // Capacitor native app → 直接请求后端服务器
  if (isCapacitor) {
    return 'http://119.45.182.166:3001/api';
  }
  // Electron 生产模式
  if (isElectronProd) {
    return 'http://localhost:3001/api';
  }
  // 浏览器开发/生产模式，使用 Vite 代理
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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

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
};
