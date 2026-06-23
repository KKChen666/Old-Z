const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data.data;
}

export const api = {
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
