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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  references?: { type: 'file' | 'note' | 'todo'; id: string }[];
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
