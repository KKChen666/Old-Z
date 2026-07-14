export interface FileItem {
  id: string;
  name: string;
  type: 'document' | 'image' | 'pdf' | 'link' | 'email' | 'other';
  size: number;
  tags: string[];
  content?: string;
  thumbnail?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  tags: string[];
  fileIds: string[];
  noteIds: string[];
  subtasks: SubTask[];
  isTodayTodo?: boolean;
  createdAt: string;
}

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  linkedFileIds: string[];
  linkedTodoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteChange {
  noteId: string;
  title: string;
  previousTitle?: string | null;
  changedAt: string;
  isNew: boolean;
  added: string[];
  removed: string[];
}

export interface NoteSnapshot {
  id: string;
  noteId: string;
  title: string;
  content: string;
  snapshotDate: string;
  createdAt: string;
}

export interface DailyReport {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  scope?: 'global' | 'note';
  noteId?: string;
  noteTitle?: string;
  conversationId?: string;
  references?: ChatReference[];
}

export interface ChatReference {
  type: 'file' | 'note' | 'todo';
  id: string;
  title?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  scope: 'global' | 'note';
  noteId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessageAt?: string;
}

export interface AiActionSuggestion {
  type: 'todo' | 'note' | 'reminder';
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  content?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'file_upload' | 'todo_created' | 'todo_completed' | 'note_created' | 'note_edited' | 'chat' | 'ai_reminder';
  title: string;
  description?: string;
  relatedId?: string;
  timestamp: string;
}

export type ViewMode = 'grid' | 'list';
export type FileFilter = 'all' | 'document' | 'image' | 'pdf' | 'link' | 'email';
export type TodoFilter = 'all' | 'pending' | 'in_progress' | 'completed';
export type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'urgent';

// ============ 全文搜索 ============
export interface SearchResult {
  entityType: 'note' | 'todo' | 'file';
  entityId: string;
  title: string;
  preview: string;
  score?: number;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  kind?: string;
  total: number;
}

// ============ 同步状态 ============
export interface SyncStatus {
  pendingCount: number;
  lastPushTime: number | null;
  lastPullTime: number | null;
  isOnline: boolean;
}

export interface SyncOverview {
  total: number;
  localOnly: number;
  remoteOnly: number;
  synced: number;
  localAhead: number;
  remoteAhead: number;
  conflicted: number;
  items: SyncFileItem[];
}

export interface SyncFileItem {
  id: string;
  title: string;
  kind: 'note' | 'todo' | 'file';
  status: 'local-only' | 'remote-only' | 'synced' | 'local-ahead' | 'remote-ahead' | 'conflict';
  localUpdatedAt: string | null;
  remoteUpdatedAt: string | null;
}

// ============ 报告生成 ============
export interface GeneratedReport {
  kind: 'weekly' | 'monthly';
  date: string;
}

export interface ReportGenerationResponse {
  success: boolean;
  data: {
    generated: number;
    reports: GeneratedReport[];
  };
}
