import { create } from 'zustand';
import type { FileItem, Todo, Note, ChatMessage, TimelineEvent, ChatConversation } from '@/types';
import { api, clearAuth, clearNativeToken } from '@/utils/api';
import { toast } from '@/components/Toast';

interface AppState {
  user: { id: string; username: string; displayName: string } | null;
  authChecked: boolean;
  files: FileItem[];
  todos: Todo[];
  notes: Note[];
  chatMessages: ChatMessage[];
  chatConversations: ChatConversation[];
  activeConversationId: string | null;
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
  setChatMessages: (messages: ChatMessage[]) => void;
  setChatConversations: (conversations: ChatConversation[]) => void;
  upsertChatConversation: (conversation: ChatConversation) => void;
  removeChatConversation: (id: string) => void;
  setActiveConversationId: (id: string | null) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authChecked: false,
  files: [],
  todos: [],
  notes: [],
  chatMessages: [],
  chatConversations: [],
  activeConversationId: null,
  timeline: [],
  sidebarCollapsed: false,
  loaded: false,

  setUser: (user) => set({ user }),

  logout: () => {
    clearAuth();
    clearNativeToken();
    set({ user: null, loaded: false });
  },

  loadData: async () => {
    if (get().loaded || !get().user) return;
    try {
      // 使用 allSettled 允许部分请求失败，不会因一个接口故障导致全部数据不可用
      const [filesR, todosR, notesR, convosR, timelineR] = await Promise.allSettled([
        api.getFiles(),
        api.getTodos(),
        api.getNotes(),
        api.getChatConversations(),
        api.getTimeline(),
      ]);
      const files = filesR.status === 'fulfilled' ? filesR.value : [];
      const todos = todosR.status === 'fulfilled' ? todosR.value : [];
      const notes = notesR.status === 'fulfilled' ? notesR.value : [];
      const chatConversations = convosR.status === 'fulfilled' ? convosR.value : [];
      const timeline = timelineR.status === 'fulfilled' ? timelineR.value : [];

      // 报告部分失败的请求
      const failed: string[] = [];
      if (filesR.status === 'rejected') failed.push('文件');
      if (todosR.status === 'rejected') failed.push('待办');
      if (notesR.status === 'rejected') failed.push('笔记');
      if (convosR.status === 'rejected') failed.push('对话');
      if (timelineR.status === 'rejected') failed.push('时间线');
      if (failed.length > 0 && failed.length < 5) {
        toast.warning(`${failed.join('、')}加载失败，其他数据正常`);
      }

      const activeConversationId = chatConversations[0]?.id || null;
      let chatMessages: ChatMessage[] = [];
      if (activeConversationId) {
        try {
          chatMessages = await api.getChatMessages({ conversationId: activeConversationId });
        } catch { /* 消息加载失败不阻塞 */ }
      }
      set({ files, todos, notes, chatMessages, chatConversations, activeConversationId, timeline, loaded: true });
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('数据加载失败，请刷新重试');
      set({ loaded: false });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addFile: (file) => {
    set((s) => ({ files: [file, ...s.files] }));
    api.createFile(file).catch(() => {
      set((s) => ({ files: s.files.filter((f) => f.id !== file.id) }));
      toast.error('文件同步失败，已撤销');
    });
  },

  removeFile: (id) => {
    const prev = get().files;
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
    api.deleteFile(id).catch(() => {
      set({ files: prev });
      toast.error('删除文件失败，已恢复');
    });
  },

  addTodo: (todo) => {
    set((s) => ({ todos: [todo, ...s.todos] }));
    api.createTodo(todo).catch(() => {
      set((s) => ({ todos: s.todos.filter((t) => t.id !== todo.id) }));
      toast.error('添加待办失败，已撤销');
    });
  },

  updateTodo: (id, updates) => {
    const prev = get().todos;
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    api.updateTodo(id, updates).catch(() => {
      set({ todos: prev });
      toast.error('更新待办失败，已恢复');
    });
  },

  toggleSubtask: (todoId, subtaskId) => {
    const prev = get().todos;
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === todoId
          ? { ...t, subtasks: t.subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st)) }
          : t
      ),
    }));
    api.toggleSubtask(todoId, subtaskId).catch(() => {
      set({ todos: prev });
      toast.error('更新子任务失败，已恢复');
    });
  },

  deleteTodo: (id) => {
    const prev = get().todos;
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    api.deleteTodo(id).catch(() => {
      set({ todos: prev });
      toast.error('删除待办失败，已恢复');
    });
  },

  addNote: (note) => {
    set((s) => ({ notes: [note, ...s.notes] }));
    api.createNote(note).catch(() => {
      set((s) => ({ notes: s.notes.filter((n) => n.id !== note.id) }));
      toast.error('添加笔记失败，已撤销');
    });
  },

  updateNote: (id, updates) => {
    const prev = get().notes;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
    api.updateNote(id, updates).catch(() => {
      set({ notes: prev });
      toast.error('保存笔记失败，已恢复');
    });
  },

  deleteNote: (id) => {
    const prev = get().notes;
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    api.deleteNote(id).catch(() => {
      set({ notes: prev });
      toast.error('删除笔记失败，已恢复');
    });
  },

  addChatMessage: (message) => {
    set((s) => ({ chatMessages: [...s.chatMessages, message] }));
  },

  setChatMessages: (messages) => set({ chatMessages: messages }),

  setChatConversations: (conversations) => set({ chatConversations: conversations }),

  upsertChatConversation: (conversation) => {
    set((s) => {
      const exists = s.chatConversations.some((item) => item.id === conversation.id);
      const chatConversations = exists
        ? s.chatConversations.map((item) => (item.id === conversation.id ? { ...item, ...conversation } : item))
        : [conversation, ...s.chatConversations];
      return { chatConversations };
    });
  },

  removeChatConversation: (id) => {
    set((s) => ({
      chatConversations: s.chatConversations.filter((item) => item.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
      chatMessages: s.activeConversationId === id ? [] : s.chatMessages,
    }));
  },

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  addTimelineEvent: (event) => {
    set((s) => ({ timeline: [event, ...s.timeline] }));
    api.createTimelineEvent(event).catch(() => {
      set((s) => ({ timeline: s.timeline.filter((e) => e.id !== event.id) }));
      toast.error('时间线事件同步失败，已撤销');
    });
  },
}));
