// In Electron production mode (file:// protocol), API requests must go directly to the backend
// In dev mode, Vite proxy handles /api → localhost:3001
const isElectronProd = typeof window !== 'undefined'
  && (window as any).electronAPI?.isElectron
  && window.location.protocol === 'file:';

const API_BASE = isElectronProd ? 'http://localhost:3001/api' : '/api';

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
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

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

  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
