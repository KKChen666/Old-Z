import pool from '../config/database.js';
import type { LlmProviderConfig } from './ai.js';

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
