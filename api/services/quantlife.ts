import pool from '../config/database.js';
import { callLLM, safeJsonParse } from './ai.js';
import type { LlmProviderConfig } from './ai.js';

// ============ 默认维度定义 ============
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

// ============ 默认进度数据 ============
export function getDefaultProgressData(): any {
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

// ============ 进度 CRUD ============
export async function getUserProgress(userId: string): Promise<any | null> {
  const [rows] = await pool.execute(
    'SELECT payload FROM quantlife_progress WHERE user_id = ?',
    [userId]
  );
  const arr = rows as any[];
  if (arr.length === 0) return null;
  const raw = arr[0].payload;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function saveUserProgress(userId: string, payload: any): Promise<void> {
  const json = JSON.stringify(payload);
  await pool.execute(
    'INSERT INTO quantlife_progress (user_id, payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)',
    [userId, json]
  );
}

// ============ LLM 配置 CRUD ============
export async function getUserLlmConfig(userId: string): Promise<LlmProviderConfig | null> {
  const [rows] = await pool.execute(
    'SELECT * FROM quantlife_llm_config WHERE user_id = ?',
    [userId]
  );
  const arr = rows as any[];
  if (arr.length === 0) return null;
  return arr[0] as LlmProviderConfig;
}

export function maskLlmConfig(config: LlmProviderConfig | null): any {
  const maskKey = (key: string) => {
    if (!key || key.length <= 8) return key ? '***' : '';
    return key.slice(0, 4) + '***' + key.slice(-4);
  };

  return {
    provider: config?.provider || 'openai',
    openai: {
      base_url: config?.openai_base_url || 'https://api.openai.com',
      api_key: maskKey(config?.openai_api_key || ''),
      model: config?.openai_model || 'gpt-4.1-mini',
    },
    anthropic: {
      base_url: config?.anthropic_base_url || 'https://api.anthropic.com',
      auth_token: maskKey(config?.anthropic_auth_token || ''),
      model: config?.anthropic_model || 'claude-sonnet-4-5',
    },
  };
}

export async function saveUserLlmConfig(userId: string, data: any): Promise<void> {
  const { provider, openai, anthropic } = data;
  await pool.execute(
    `INSERT INTO quantlife_llm_config (user_id, provider, openai_base_url, openai_api_key, openai_model, anthropic_base_url, anthropic_auth_token, anthropic_model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       openai_base_url = VALUES(openai_base_url),
       openai_api_key = VALUES(openai_api_key),
       openai_model = VALUES(openai_model),
       anthropic_base_url = VALUES(anthropic_base_url),
       anthropic_auth_token = VALUES(anthropic_auth_token),
       anthropic_model = VALUES(anthropic_model)`,
    [
      userId,
      provider || 'openai',
      openai?.base_url || 'https://api.openai.com',
      openai?.api_key || '',
      openai?.model || 'gpt-4.1-mini',
      anthropic?.base_url || 'https://api.anthropic.com',
      anthropic?.auth_token || '',
      anthropic?.model || 'claude-sonnet-4-5',
    ]
  );
}

// ============ EXP 计算 ============
const DIFFICULTY_MULT: Record<string, number> = { easy: 0.8, normal: 1.0, hard: 1.25 };

export function calcExp(minutes: number, baseRatePerHour: number, difficultyMult: number, qualityMult: number): number {
  return Math.round((minutes / 60) * baseRatePerHour * difficultyMult * qualityMult);
}

export function getDifficultyMult(difficulty: string): number {
  return DIFFICULTY_MULT[difficulty] || 1.0;
}

export function recomputeLevels(data: any): void {
  const EXP_PER_LEVEL = 200;
  data.level = Math.floor(data.total_exp / EXP_PER_LEVEL) + 1;
  data.current_level_exp = data.total_exp % EXP_PER_LEVEL;
  data.exp_to_next = EXP_PER_LEVEL;
}

// ============ 维度工具 ============
export function getEnabledDimensionKeys(data: any): Set<string> {
  const ui = data?.meta?.ui?.dimensionConfig;
  if (ui?.enabledByKey) {
    const keys = Object.entries(ui.enabledByKey)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (keys.length > 0) return new Set(keys);
  }
  return new Set(DEFAULT_DIMENSION_ORDER);
}

// ============ Encoding 异常检测 ============
export function countEncodingAnomalies(str: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '�') count++;
    if (str.slice(i, i + 3) === '???') { count++; i += 2; }
  }
  return count;
}

// ============ AI 文本解析 ============
export function buildIngestSystemPrompt(date: string, enabledKeys: Set<string>, dimensionDefs: Record<string, any>, hintDimensionKey?: string): string {
  const dimList = Array.from(enabledKeys)
    .map(k => {
      const def = dimensionDefs[k] || DEFAULT_DIMENSION_DEFS[k];
      return `- ${k}: ${def?.name || k}（${def?.emoji || ''}）`;
    })
    .join('\n');

  const hintLine = hintDimensionKey
    ? `\n用户提示：可能属于「${hintDimensionKey}」维度。`
    : '';

  return `你是"人生努力可视化系统"的行为解析器。用户会用自然语言描述今天做了什么，你需要把描述解析成结构化的活动列表。

可用维度（dimension_key 必须是以下之一）：
${dimList}

难度（difficulty）只能是以下之一：easy, normal, hard

请输出严格 JSON 格式：
{
  "activities": [
    {
      "date": "${date}",
      "dimension_key": "research",
      "task_type": "学习成长",
      "difficulty": "normal",
      "description": "阅读了3篇关于机器学习的论文",
      "minutes": 120,
      "completed": true
    }
  ]
}

规则：
1. minutes 是花费的分钟数，必须是正整数（1-1440）
2. difficulty 必须根据用户描述的强度/难度来判断：轻松=easy，正常=normal，困难=hard
3. description 简洁描述活动内容（不超过100字）
4. completed 默认为 true，除非用户明确说"没做完"、"半途而废"等
5. 如果用户描述中包含多个活动，请拆分为多个条目
6. 不要编造用户没有提到的活动
7. task_type 用维度的中文名称
8. 每个 activity 的 date 字段都使用 "${date}"`;
}

export function buildIngestUserMessage(text: string, hintDimensionKey?: string): string {
  const hintLine = hintDimensionKey ? `\n用户提示：可能属于「${hintDimensionKey}」维度。` : '';
  return `请解析以下活动描述：\n${text}${hintLine}`;
}

export function validateAndApplyIngest(
  progress: any,
  parsedActivities: any[],
  date: string,
  enabledKeys: Set<string>,
  dimensionDefs: Record<string, any>
): any[] {
  const validatedEntries: any[] = [];

  for (const act of parsedActivities) {
    const dimKey = act.dimension_key;
    if (!dimKey || !enabledKeys.has(dimKey)) continue;
    const difficulty = ['easy', 'normal', 'hard'].includes(act.difficulty) ? act.difficulty : 'normal';
    const minutes = Math.max(1, Math.min(1440, parseInt(String(act.minutes)) || 60));
    const completed = act.completed !== false;

    const def = dimensionDefs[dimKey] || DEFAULT_DIMENSION_DEFS[dimKey];
    const baseRate = def?.exp_config?.base_rate_per_hour || 50;
    const coeff = def?.exp_config?.coefficient || 1.0;
    const diffMult = getDifficultyMult(difficulty);
    const expGained = completed ? calcExp(minutes, baseRate, diffMult, coeff) : 0;

    validatedEntries.push({
      date,
      dimension_key: dimKey,
      task_type: def?.name || dimKey,
      difficulty: `AI解析·${difficulty}·${minutes}min`,
      description: String(act.description || '').slice(0, 200),
      exp_gained: expGained,
      completed,
    });
  }

  // 应用到进度
  if (!progress.daily_log) progress.daily_log = {};
  if (!progress.daily_log[date]) {
    progress.daily_log[date] = { date, entries: [], total_exp: 0, all_done: false, insights: [] };
  }

  for (const entry of validatedEntries) {
    progress.history.push(entry);
    if (!progress.dimensions[entry.dimension_key]) {
      progress.dimensions[entry.dimension_key] = { total_exp: 0 };
    }
    progress.dimensions[entry.dimension_key].total_exp += entry.exp_gained;
    progress.total_exp += entry.exp_gained;
    progress.daily_log[date].entries.push(entry);
  }

  progress.daily_log[date].total_exp = progress.daily_log[date].entries.reduce(
    (sum: number, e: any) => sum + e.exp_gained, 0
  );

  recomputeLevels(progress);
  progress.meta.last_synced_at = new Date().toISOString();

  return validatedEntries;
}

// ============ AI 规划 ============
export const PLAN_SYSTEM_PROMPT = `你是"AI 人生升级游戏"的策略规划师。用户设定了成长目标，你需要：
1. 分析目标的可行路径
2. 给出 3-6 句主线策略（main_line），像游戏主线任务一样指引方向
3. 给出 1-3 条今天可以立即执行的行动建议（today_actions）

请输出严格 JSON 格式：
{
  "main_line": "这里是3-6句话的主线策略...",
  "today_actions": [
    "今天可以做的具体行动1",
    "今天可以做的具体行动2"
  ]
}`;

export function buildPlanUserMessage(goal: string, context: string, stages: any[]): string {
  const stageText = (stages && stages.length > 0)
    ? stages.map((s: any, i: number) => `${i + 1}. ${s.title || '阶段'} [${s.status || 'active'}]`).join('\n')
    : '（暂无阶段）';

  return `目标：${goal}
背景：${context || '无'}
当前阶段：\n${stageText}

请帮我制定主线策略和今日行动。`;
}
