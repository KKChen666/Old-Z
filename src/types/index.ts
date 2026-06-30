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
  /** 关联的成长维度，完成后自动获得 EXP */
  dimension_key?: string;
  /** 是否已发放 EXP */
  exp_granted?: boolean;
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

// ============ QuantLife Types ============

export interface QLDimensionDef {
  key: string;
  name: string;
  emoji: string;
  color: string;
  goal: number;
  archived?: boolean;
  exp_config: { base_rate_per_hour: number; coefficient: number };
}

export interface QLProgressMeta {
  schema_version: number;
  last_synced_at: string | null;
  dimensions: { schemaVersion: number; defs: Record<string, QLDimensionDef> };
  ui: {
    dimensionConfig: {
      schemaVersion: number;
      order: string[];
      enabledByKey: Record<string, boolean>;
    };
  };
  profile: {
    name: string;
    nickname: string;
    app_title: string;
    tagline: string;
    avatar: string;
    avatar_text: string;
    avatar_url: string;
    theme: string;
  };
}

export interface QLHistoryEntry {
  date: string;
  dimension_key: string;
  task_type: string;
  difficulty: string;
  description: string;
  exp_gained: number;
  completed: boolean;
}

export interface QLTask {
  id: string;
  title: string;
  dimension_key: string;
  minutes: number;
  quality: 'low' | 'normal' | 'high';
  done: boolean;
  reward_entry_id: string | null;
  reward_exp: number;
  status?: 'not_started' | 'in_progress' | 'done';
}

export interface QLTaskCamp {
  daily: { title: string; reward_exp: number; tasks: QLTask[] };
  monthly: { title: string; tasks: QLTask[] };
  yearly: { title: string; tasks: QLTask[] };
}

export interface QLAiPlanDirection {
  goal: string;
  context: string;
  main_line: string;
  today_actions: string[];
  stages: { title: string; status: 'active' | 'done' }[];
  updated_at: string | null;
}

export interface QLWealth {
  current: number;
  target: number;
  year: number;
}

export interface QLDailyLogEntry {
  date: string;
  entries: QLHistoryEntry[];
  total_exp: number;
  all_done: boolean;
  insights: string[];
}

export interface QLProgressData {
  meta: QLProgressMeta;
  level: number;
  total_exp: number;
  current_level_exp: number;
  exp_to_next: number;
  dimensions: Record<string, { total_exp: number }>;
  wealth: QLWealth;
  history: QLHistoryEntry[];
  daily_log: Record<string, QLDailyLogEntry>;
  achievements: any[];
  insights: string[];
  ai_plan_direction: QLAiPlanDirection;
  task_camp: QLTaskCamp;
}

export interface QLLlmConfig {
  provider: 'openai' | 'anthropic';
  openai: { base_url: string; api_key: string; model: string };
  anthropic: { base_url: string; auth_token: string; model: string };
}

export type QLDifficulty = 'easy' | 'normal' | 'hard';
export type QLQuality = 'low' | 'normal' | 'high';
export type QLTaskTier = 'daily' | 'monthly' | 'yearly';
