import pool from '../config/database.js';
import type { LlmProviderConfig } from './ai.js';
import { getLocalLlmConfigOverride } from './llmRequestContext.js';

export type LlmPresetProvider = 'openai' | 'anthropic';

export interface LlmPreset {
  id: string;
  name: string;
  provider: LlmPresetProvider;
  base_url: string;
  api_key: string;
  model: string;
  balance_url?: string;
  balance_method?: 'GET' | 'POST';
  balance_headers?: string;
  balance_body?: string;
  balance_path?: string;
  is_active?: boolean;
}

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

function maskKey(key: string) {
  if (!key || key.length <= 8) return key ? '***' : '';
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

function normalizePreset(raw: any, fallbackIndex = 0): LlmPreset {
  const provider = raw?.provider === 'anthropic' ? 'anthropic' : 'openai';
  return {
    id: String(raw?.id || `llm-${Date.now()}-${fallbackIndex}`),
    name: String(raw?.name || (provider === 'anthropic' ? 'Anthropic 兼容' : 'OpenAI 兼容')).slice(0, 100),
    provider,
    base_url: String(raw?.base_url || (provider === 'anthropic' ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_OPENAI_BASE_URL)).slice(0, 512),
    api_key: String(raw?.api_key || raw?.auth_token || '').slice(0, 2048),
    model: String(raw?.model || (provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4.1-mini')).slice(0, 128),
    balance_url: String(raw?.balance_url || '').slice(0, 1024),
    balance_method: raw?.balance_method === 'POST' ? 'POST' : 'GET',
    balance_headers: String(raw?.balance_headers || '').slice(0, 8000),
    balance_body: String(raw?.balance_body || '').slice(0, 8000),
    balance_path: String(raw?.balance_path || '').slice(0, 200),
    is_active: !!raw?.is_active,
  };
}

function presetToLlmConfig(preset: LlmPreset): LlmProviderConfig {
  if (preset.provider === 'anthropic') {
    return {
      provider: 'anthropic',
      openai_base_url: DEFAULT_OPENAI_BASE_URL,
      openai_api_key: '',
      openai_model: 'gpt-4.1-mini',
      anthropic_base_url: preset.base_url || DEFAULT_ANTHROPIC_BASE_URL,
      anthropic_auth_token: preset.api_key || '',
      anthropic_model: preset.model || 'claude-sonnet-4-5',
    };
  }

  return {
    provider: 'openai',
    openai_base_url: preset.base_url || DEFAULT_OPENAI_BASE_URL,
    openai_api_key: preset.api_key || '',
    openai_model: preset.model || 'gpt-4.1-mini',
    anthropic_base_url: DEFAULT_ANTHROPIC_BASE_URL,
    anthropic_auth_token: '',
    anthropic_model: 'claude-sonnet-4-5',
  };
}

function legacyConfigToPreset(row: any): LlmPreset {
  if (row.provider === 'anthropic') {
    return {
      id: 'legacy-anthropic',
      name: 'Anthropic 兼容',
      provider: 'anthropic',
      base_url: row.anthropic_base_url || DEFAULT_ANTHROPIC_BASE_URL,
      api_key: row.anthropic_auth_token || '',
      model: row.anthropic_model || 'claude-sonnet-4-5',
      is_active: true,
    };
  }

  return {
    id: 'legacy-openai',
    name: 'OpenAI 兼容',
    provider: 'openai',
    base_url: row.openai_base_url || DEFAULT_OPENAI_BASE_URL,
    api_key: row.openai_api_key || '',
    model: row.openai_model || 'gpt-4.1-mini',
    is_active: true,
  };
}

function maskPreset(preset: LlmPreset): LlmPreset {
  return { ...preset, api_key: maskKey(preset.api_key || '') };
}

async function getLegacyConfig(userId: string): Promise<any | null> {
  const [rows] = await pool.execute('SELECT * FROM quantlife_llm_config WHERE user_id = ?', [userId]);
  return (rows as any[])[0] || null;
}

export async function getUserLlmConfig(userId: string): Promise<LlmProviderConfig | null> {
  const localOverride = getLocalLlmConfigOverride();
  if (localOverride) return localOverride;

  const [rows] = await pool.execute(
    'SELECT * FROM quantlife_llm_presets WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC',
    [userId]
  );
  const presets = rows as any[];
  if (presets.length > 0) return presetToLlmConfig(normalizePreset(presets[0]));

  const legacy = await getLegacyConfig(userId);
  return legacy ? presetToLlmConfig(legacyConfigToPreset(legacy)) : null;
}

export async function getUserLlmSettings(userId: string): Promise<any> {
  const [rows] = await pool.execute(
    'SELECT * FROM quantlife_llm_presets WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC',
    [userId]
  );
  const presets = (rows as any[]).map((row) => normalizePreset(row));

  if (presets.length === 0) {
    const legacy = await getLegacyConfig(userId);
    if (legacy) presets.push(legacyConfigToPreset(legacy));
  }

  const active = presets.find((preset) => preset.is_active) || presets[0] || null;
  return {
    activeCloudId: active?.id || '',
    cloudPresets: presets.map(maskPreset),
  };
}

export async function saveUserLlmConfig(userId: string, data: any): Promise<void> {
  const rawPresets = Array.isArray(data?.cloudPresets) ? data.cloudPresets : [];
  const cloudPresets = rawPresets.length
    ? rawPresets.map((preset: any, index: number) => normalizePreset(preset, index))
    : [normalizePreset({
      id: 'default',
      name: data?.provider === 'anthropic' ? 'Anthropic 兼容' : 'OpenAI 兼容',
      provider: data?.provider || 'openai',
      base_url: data?.provider === 'anthropic' ? data?.anthropic?.base_url : data?.openai?.base_url,
      api_key: data?.provider === 'anthropic' ? data?.anthropic?.auth_token : data?.openai?.api_key,
      model: data?.provider === 'anthropic' ? data?.anthropic?.model : data?.openai?.model,
      is_active: true,
    })];

  const activeCloudId = String(data?.activeCloudId || cloudPresets.find((preset: LlmPreset) => preset.is_active)?.id || cloudPresets[0]?.id || '');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existingRows] = await conn.execute('SELECT id, api_key FROM quantlife_llm_presets WHERE user_id = ?', [userId]);
    const existingKeys = new Map((existingRows as any[]).map((row) => [row.id, row.api_key || '']));

    await conn.execute('DELETE FROM quantlife_llm_presets WHERE user_id = ?', [userId]);

    for (const preset of cloudPresets) {
      const apiKey = preset.api_key.includes('***') ? (existingKeys.get(preset.id) || '') : preset.api_key;
      await conn.execute(
        `INSERT INTO quantlife_llm_presets
          (id, user_id, name, provider, base_url, api_key, model, balance_url, balance_method, balance_headers, balance_body, balance_path, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          preset.id,
          userId,
          preset.name,
          preset.provider,
          preset.base_url,
          apiKey,
          preset.model,
          preset.balance_url || '',
          preset.balance_method || 'GET',
          preset.balance_headers || '',
          preset.balance_body || '',
          preset.balance_path || '',
          preset.id === activeCloudId,
        ]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function readPath(value: any, path?: string) {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current, part) => current?.[part], value);
}

function replaceVars(text: string, preset: LlmPreset) {
  return text
    .split('{apiKey}').join(preset.api_key || '')
    .split('{baseUrl}').join(preset.base_url || '')
    .split('{model}').join(preset.model || '');
}

export async function fetchLlmBalance(preset: LlmPreset): Promise<any> {
  const normalized = normalizePreset(preset);
  if (!normalized.balance_url) throw new Error('请先填写余额查询接口');

  let headers: Record<string, string> = {};
  if (normalized.balance_headers?.trim()) {
    try {
      headers = JSON.parse(replaceVars(normalized.balance_headers, normalized));
    } catch {
      throw new Error('余额查询 Headers 必须是 JSON 对象');
    }
  }

  const res = await fetch(replaceVars(normalized.balance_url, normalized), {
    method: normalized.balance_method || 'GET',
    headers,
    body: normalized.balance_method === 'POST' && normalized.balance_body
      ? replaceVars(normalized.balance_body, normalized)
      : undefined,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`余额查询失败 ${res.status}: ${text.slice(0, 300)}`);

  let parsed: any = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return {
    value: readPath(parsed, normalized.balance_path),
    raw: parsed,
  };
}
