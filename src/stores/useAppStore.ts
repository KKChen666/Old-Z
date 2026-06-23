import { create } from 'zustand';
import type { FileItem, Todo, Note, ChatMessage, TimelineEvent } from '@/types';

interface AppState {
  files: FileItem[];
  todos: Todo[];
  notes: Note[];
  chatMessages: ChatMessage[];
  timeline: TimelineEvent[];
  sidebarCollapsed: boolean;

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

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

const mockFiles: FileItem[] = [
  { id: 'f1', name: '产品需求文档_PRD.docx', type: 'document', size: 245760, tags: ['产品', 'PRD'], content: 'Old Z 产品需求概述...', createdAt: now, updatedAt: now },
  { id: 'f2', name: '项目架构图.png', type: 'image', size: 1048576, tags: ['架构', '设计'], createdAt: now, updatedAt: now },
  { id: 'f3', name: 'API接口文档.pdf', type: 'pdf', size: 524288, tags: ['API', '后端'], createdAt: now, updatedAt: now },
  { id: 'f4', name: '竞品分析报告.docx', type: 'document', size: 327680, tags: ['分析', '竞品'], createdAt: now, updatedAt: now },
  { id: 'f5', name: '用户调研数据.xlsx', type: 'document', size: 163840, tags: ['调研', '数据'], createdAt: now, updatedAt: now },
  { id: 'f6', name: 'UI设计稿_v2.fig', type: 'other', size: 2097152, tags: ['设计', 'UI'], createdAt: now, updatedAt: now },
];

const mockTodos: Todo[] = [
  { id: 't1', title: '完成 Dashboard 页面开发', description: '实现首页概览和拖拽热区', priority: 'high', status: 'in_progress', dueDate: today, tags: ['开发', '前端'], fileIds: [], noteIds: ['n1'], subtasks: [{ id: 's1', title: '拖拽热区组件', done: true }, { id: 's2', title: '待办卡片组件', done: false }], createdAt: now },
  { id: 't2', title: '设计知识图谱可视化方案', description: '调研 D3.js 和力导向图实现', priority: 'medium', status: 'pending', dueDate: '2026-06-25', tags: ['设计', '图谱'], fileIds: ['f2'], noteIds: [], subtasks: [], createdAt: now },
  { id: 't3', title: 'AI 聊天接口对接', description: '实现多轮对话和上下文关联', priority: 'high', status: 'pending', dueDate: '2026-06-26', tags: ['AI', '后端'], fileIds: ['f3'], noteIds: [], subtasks: [{ id: 's3', title: '接口定义', done: true }, { id: 's4', title: '前端调用', done: false }, { id: 's5', title: '流式响应', done: false }], createdAt: now },
  { id: 't4', title: '用户反馈收集与整理', description: '整理内测用户反馈', priority: 'low', status: 'completed', tags: ['运营'], fileIds: [], noteIds: [], subtasks: [], createdAt: now },
  { id: 't5', title: '全局搜索功能优化', description: '支持全文搜索和模糊匹配', priority: 'medium', status: 'pending', dueDate: '2026-06-28', tags: ['开发', '搜索'], fileIds: [], noteIds: [], subtasks: [], createdAt: now },
];

const mockNotes: Note[] = [
  { id: 'n1', title: '项目技术选型笔记', content: '# 技术选型\n\n## 前端\n- React 18 + TypeScript\n- Tailwind CSS\n- Zustand 状态管理\n\n## 后端\n- Express.js\n- PostgreSQL\n- Redis 缓存\n\n## AI\n- RAG 检索增强生成\n- 向量数据库 Qdrant', tags: ['技术', '架构'], linkedFileIds: ['f1'], linkedTodoIds: ['t1'], createdAt: now, updatedAt: now },
  { id: 'n2', title: '全局拖拽系统设计思路', content: '# 拖拽系统设计\n\n核心理念：Everything is Draggable\n\n## 实现方案\n1. 全局 dragover/drop 监听\n2. MIME 类型自动识别\n3. 文件内容解析引擎\n4. AI 自动标签生成\n\n## 用户体验\n- 拖入时脉冲发光反馈\n- 解析进度条动画\n- 成功后卡片飞入动画', tags: ['设计', '拖拽'], linkedFileIds: [], linkedTodoIds: ['t1'], createdAt: now, updatedAt: now },
  { id: 'n3', title: 'AI 提醒策略', content: '# AI 主动提醒策略\n\n## 触发条件\n- 待办临近截止日期\n- 习惯中断检测\n- 项目进度异常\n\n## 提醒方式\n- 桌面通知\n- Dashboard 卡片\n- 时间轴记录', tags: ['AI', '提醒'], linkedFileIds: [], linkedTodoIds: [], createdAt: now, updatedAt: now },
];

const mockChatMessages: ChatMessage[] = [
  { id: 'c1', role: 'user', content: '帮我总结一下当前项目的进展情况', timestamp: now },
  { id: 'c2', role: 'assistant', content: '根据你的待办和笔记数据，当前项目进展如下：\n\n**进行中的任务：**\n- Dashboard 页面开发（已完成拖拽热区，待办卡片待完成）\n\n**待处理的高优先级任务：**\n- AI 聊天接口对接\n\n**已完成：**\n- 用户反馈收集与整理\n\n建议优先完成 Dashboard 的待办卡片组件，然后开始 AI 聊天接口的前端调用工作。', timestamp: now, references: [{ type: 'todo', id: 't1' }, { type: 'note', id: 'n1' }] },
];

const mockTimeline: TimelineEvent[] = [
  { id: 'e1', type: 'file_upload', title: '上传了 产品需求文档_PRD.docx', relatedId: 'f1', timestamp: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: 'e2', type: 'note_created', title: '创建了笔记「项目技术选型笔记」', relatedId: 'n1', timestamp: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: 'e3', type: 'todo_created', title: '创建了待办「完成 Dashboard 页面开发」', relatedId: 't1', timestamp: new Date(Date.now() - 3600000 * 3).toISOString() },
  { id: 'e4', type: 'todo_completed', title: '完成了待办「用户反馈收集与整理」', relatedId: 't4', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: 'e5', type: 'ai_reminder', title: 'AI 提醒：Dashboard 待办卡片组件待完成', description: '距离截止日期还有 2 天', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'e6', type: 'chat', title: '与 AI 助手进行了对话', relatedId: 'c1', timestamp: new Date(Date.now() - 1800000).toISOString() },
];

export const useAppStore = create<AppState>((set) => ({
  files: mockFiles,
  todos: mockTodos,
  notes: mockNotes,
  chatMessages: mockChatMessages,
  timeline: mockTimeline,
  sidebarCollapsed: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  addFile: (file) => set((state) => ({ files: [file, ...state.files] })),
  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  addTodo: (todo) => set((state) => ({ todos: [todo, ...state.todos] })),
  updateTodo: (id, updates) =>
    set((state) => ({
      todos: state.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  toggleSubtask: (todoId, subtaskId) =>
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === todoId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, done: !s.done } : s
              ),
            }
          : t
      ),
    })),
  deleteTodo: (id) => set((state) => ({ todos: state.todos.filter((t) => t.id !== id) })),

  addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  deleteNote: (id) => set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  addTimelineEvent: (event) =>
    set((state) => ({ timeline: [event, ...state.timeline] })),
}));
