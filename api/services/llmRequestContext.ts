import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
import type { LlmProviderConfig } from './ai.js';

const storage = new AsyncLocalStorage<{ llmConfig?: LlmProviderConfig }>();

function normalizeLocalConfig(raw: any): LlmProviderConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const provider = raw.provider === 'anthropic' ? 'anthropic' : 'openai';
  return {
    provider,
    openai_base_url: String(raw.openai_base_url || raw.base_url || 'https://api.openai.com'),
    openai_api_key: String(raw.openai_api_key || raw.api_key || ''),
    openai_model: String(raw.openai_model || raw.model || 'gpt-4.1-mini'),
    anthropic_base_url: String(raw.anthropic_base_url || raw.base_url || 'https://api.anthropic.com'),
    anthropic_auth_token: String(raw.anthropic_auth_token || raw.api_key || raw.auth_token || ''),
    anthropic_model: String(raw.anthropic_model || raw.model || 'claude-sonnet-4-5'),
  };
}

export function llmRequestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.header('x-oldz-local-llm-config');
  let llmConfig: LlmProviderConfig | undefined;

  if (header && header.length < 20000) {
    try {
      llmConfig = normalizeLocalConfig(JSON.parse(header)) || undefined;
    } catch {
      llmConfig = undefined;
    }
  }

  storage.run({ llmConfig }, next);
}

export function getLocalLlmConfigOverride(): LlmProviderConfig | undefined {
  return storage.getStore()?.llmConfig;
}
