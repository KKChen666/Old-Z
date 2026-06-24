import { create } from 'zustand';
import type { FileItem, Todo, Note, ChatMessage, TimelineEvent } from '@/types';
import { api, clearAuth } from '@/utils/api';

interface AppState {
  user: { id: string; username: string; displayName: string } | null;
  authChecked: boolean;
  files: FileItem[];
  todos: Todo[];
  notes: Note[];
  chatMessages: ChatMessage[];
  timeline: TimelineEvent[];
  sidebarCollapsed: boolean;
  loaded: boolean;

  setUser: (user: { id: string; username: string; displayName: string } | null) => void;
  logout: () => void;
  loadData: () => Promise<void>;
  toggleSidebar: () => void;
  addFile: (file: FileItem) => void;
  removeFile: (id: string) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteTodo: (id: string) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authChecked: false,
  files: [],
  todos: [],
  notes: [],
  chatMessages: [],
  timeline: [],
  sidebarCollapsed: false,
  loaded: false,

  setUser: (user) => set({ user }),

  logout: () => {
    clearAuth();
    set({ user: null, loaded: false });
  },

  loadData: async () => {
    if (get().loaded || !get().user) return;
    try {
      const [files, todos, notes, chatMessages, timeline] = await Promise.all([
        api.getFiles(),
        api.getTodos(),
        api.getNotes(),
        api.getChatMessages(),
        api.getTimeline(),
      ]);
      set({ files, todos, notes, chatMessages, timeline, loaded: true });
    } catch (error) {
      console.error('Failed to load data:', error);
      set({ loaded: true });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addFile: (file) => {
    set((s) => ({ files: [file, ...s.files] }));
    api.createFile(file).catch(console.error);
  },

  removeFile: (id) => {
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
    api.deleteFile(id).catch(console.error);
  },

  addTodo: (todo) => {
    set((s) => ({ todos: [todo, ...s.todos] }));
    api.createTodo(todo).catch(console.error);
  },

  updateTodo: (id, updates) => {
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    api.updateTodo(id, updates).catch(console.error);
  },

  toggleSubtask: (todoId, subtaskId) => {
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === todoId
          ? { ...t, subtasks: t.subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st)) }
          : t
      ),
    }));
    api.toggleSubtask(todoId, subtaskId).catch(console.error);
  },

  deleteTodo: (id) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    api.deleteTodo(id).catch(console.error);
  },

  addNote: (note) => {
    set((s) => ({ notes: [note, ...s.notes] }));
    api.createNote(note).catch(console.error);
  },

  updateNote: (id, updates) => {
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
    api.updateNote(id, updates).catch(console.error);
  },

  deleteNote: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    api.deleteNote(id).catch(console.error);
  },

  addChatMessage: (message) => {
    set((s) => ({ chatMessages: [...s.chatMessages, message] }));
  },

  addTimelineEvent: (event) => {
    set((s) => ({ timeline: [event, ...s.timeline] }));
    api.createTimelineEvent(event).catch(console.error);
  },
}));
