import { create } from 'zustand';
import type { QLProgressData, QLLlmConfig } from '@/types';
import { api } from '@/utils/api';

// ============ 默认进度数据（前端 fallback） ============
const DEFAULT_DIMENSION_DEFS: Record<string, any> = {
  research: { key: 'research', name: '学习成长', emoji: '📚', color: '#2f7cf6', goal: 2000, archived: false, exp_config: { base_rate_per_hour: 60, coefficient: 1.2 } },
  coding:   { key: 'coding',   name: '编程能力', emoji: '💻', color: '#34c759', goal: 2000, archived: false, exp_config: { base_rate_per_hour: 70, coefficient: 1.2 } },
  fitness:  { key: 'fitness',  name: '运动健康', emoji: '🏃', color: '#ff9500', goal: 1500, archived: false, exp_config: { base_rate_per_hour: 40, coefficient: 0.8 } },
  speech:   { key: 'speech',   name: '沟通表达', emoji: '🗣️', color: '#af52de', goal: 1200, archived: false, exp_config: { base_rate_per_hour: 50, coefficient: 1.0 } },
  media:    { key: 'media',    name: '创作表达', emoji: '🎨', color: '#ff3b30', goal: 1500, archived: false, exp_config: { base_rate_per_hour: 55, coefficient: 1.0 } },
  editing:  { key: 'editing',  name: '剪辑技能', emoji: '✂️', color: '#5ac8fa', goal: 1200, archived: false, exp_config: { base_rate_per_hour: 45, coefficient: 1.0 } },
  makeup:   { key: 'makeup',   name: '形象管理', emoji: '💄', color: '#ff2d55', goal: 1000, archived: false, exp_config: { base_rate_per_hour: 30, coefficient: 0.8 } },
  tem:      { key: 'tem',      name: '专项技能', emoji: '⚡', color: '#8e8e93', goal: 2000, archived: false, exp_config: { base_rate_per_hour: 60, coefficient: 1.2 } },
};

const DEFAULT_DIMENSION_ORDER = ['research', 'coding', 'fitness', 'speech', 'media', 'editing', 'makeup', 'tem'];

export function getDefaultProgressData(): QLProgressData {
  const enabledByKey: Record<string, boolean> = {};
  const dimensions: Record<string, { total_exp: number }> = {};
  for (const key of DEFAULT_DIMENSION_ORDER) {
    enabledByKey[key] = true;
    dimensions[key] = { total_exp: 0 };
  }

  return {
    meta: {
      schema_version: 2,
      last_synced_at: null,
      dimensions: { schemaVersion: 2, defs: { ...DEFAULT_DIMENSION_DEFS } },
      ui: {
        dimensionConfig: {
          schemaVersion: 2,
          order: [...DEFAULT_DIMENSION_ORDER],
          enabledByKey,
        },
      },
      profile: {
        name: 'QuantLife',
        nickname: '成长玩家',
        app_title: 'QuantLife',
        tagline: '把生活变成一场持续升级的游戏。',
        avatar: '',
        avatar_text: 'Q',
        avatar_url: '',
        theme: 'default',
      },
    },
    level: 1,
    total_exp: 0,
    current_level_exp: 0,
    exp_to_next: 200,
    dimensions,
    wealth: { current: 0, target: 100000, year: new Date().getFullYear() },
    history: [],
    daily_log: {},
    achievements: [],
    insights: [],
    ai_plan_direction: {
      goal: '',
      context: '',
      main_line: '',
      today_actions: [],
      stages: [],
      updated_at: null,
    },
    task_camp: {
      daily: { title: '每日任务', reward_exp: 120, tasks: [] },
      monthly: { title: '月度任务', tasks: [] },
      yearly: { title: '年度任务', tasks: [] },
    },
  };
}

// ============ 工具函数 ============
export function formatYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYMDLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function calcExp(minutes: number, baseRatePerHour: number, difficultyMult: number, qualityMult: number): number {
  return Math.round((minutes / 60) * baseRatePerHour * difficultyMult * qualityMult);
}

export const DIFFICULTY_MULT: Record<string, number> = { easy: 0.8, normal: 1.0, hard: 1.25 };
export const QUALITY_MULT: Record<string, number> = { low: 0.8, normal: 1.0, high: 1.2 };

export function getDifficultyMult(difficulty: string): number {
  return DIFFICULTY_MULT[difficulty] || 1.0;
}

export function recomputeLevels(data: QLProgressData): void {
  const EXP_PER_LEVEL = 200;
  data.level = Math.floor(data.total_exp / EXP_PER_LEVEL) + 1;
  data.current_level_exp = data.total_exp % EXP_PER_LEVEL;
  data.exp_to_next = EXP_PER_LEVEL;
}

export function getEnabledDimensionKeys(data: QLProgressData): string[] {
  const ui = data?.meta?.ui?.dimensionConfig;
  if (ui?.enabledByKey) {
    const keys = Object.entries(ui.enabledByKey)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (keys.length > 0) return keys;
  }
  return [...DEFAULT_DIMENSION_ORDER];
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// ============ Store ============
interface QuantLifeState {
  progressData: QLProgressData | null;
  llmConfig: QLLlmConfig | null;
  selectedDate: string;
  activeSection: string;
  loaded: boolean;
  isSaving: boolean;

  loadProgress: () => Promise<void>;
  saveProgress: (data?: QLProgressData) => Promise<void>;
  loadLlmConfig: () => Promise<void>;
  saveLlmConfig: (config: QLLlmConfig) => Promise<void>;
  updateProgress: (mutator: (draft: QLProgressData) => void) => void;
  setActiveSection: (section: string) => void;
  setSelectedDate: (date: string) => void;
}

export const useQuantLifeStore = create<QuantLifeState>((set, get) => ({
  progressData: null,
  llmConfig: null,
  selectedDate: formatYMDLocal(new Date()),
  activeSection: 'overview',
  loaded: false,
  isSaving: false,

  loadProgress: async () => {
    if (get().loaded) return;
    try {
      const data = await api.quantlife.getProgress();
      if (data) {
        set({ progressData: data, loaded: true });
      } else {
        const defaults = getDefaultProgressData();
        set({ progressData: defaults, loaded: true });
      }
    } catch (error) {
      console.error('Failed to load quantlife progress:', error);
      const defaults = getDefaultProgressData();
      set({ progressData: defaults, loaded: true });
    }
  },

  saveProgress: async (data) => {
    const current = data || get().progressData;
    if (!current) return;
    if (get().isSaving) return;
    set({ isSaving: true });
    try {
      await api.quantlife.saveProgress(current);
    } catch (error) {
      console.error('Failed to save quantlife progress:', error);
    } finally {
      set({ isSaving: false });
    }
  },

  loadLlmConfig: async () => {
    try {
      const config = await api.quantlife.getLlmConfig();
      if (config) set({ llmConfig: config });
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    }
  },

  saveLlmConfig: async (config) => {
    try {
      await api.quantlife.saveLlmConfig(config);
      set({ llmConfig: config });
    } catch (error) {
      console.error('Failed to save LLM config:', error);
    }
  },

  updateProgress: (mutator) => {
    const current = get().progressData;
    if (!current) return;
    const draft = deepClone(current);
    mutator(draft);
    set({ progressData: draft });
  },

  setActiveSection: (section) => set({ activeSection: section }),

  setSelectedDate: (date) => set({ selectedDate: date }),
}));
