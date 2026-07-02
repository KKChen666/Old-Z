import React, { useEffect, useState } from 'react';
import { Check, Cloud, HardDrive, Loader2, Plus, Trash2, Wallet, Zap } from 'lucide-react';
import { api } from '@/utils/api';
import { cn } from '@/lib/utils';

type LlmStorage = 'cloud' | 'local';
type LlmProvider = 'openai' | 'anthropic';

interface LlmPreset {
  id: string;
  name: string;
  provider: LlmProvider;
  base_url: string;
  api_key: string;
  model: string;
  balance_url: string;
  balance_method: 'GET' | 'POST';
  balance_headers: string;
  balance_body: string;
  balance_path: string;
}

const LOCAL_LLM_PRESETS_KEY = 'old-z-local-llm-presets';
const ACTIVE_LLM_ID_KEY = 'old-z-active-llm-id';
const ACTIVE_LLM_STORAGE_KEY = 'old-z-active-llm-storage';

function createPreset(storage: LlmStorage, index: number): LlmPreset {
  return {
    id: `${storage}-${Date.now()}-${index}`,
    name: storage === 'cloud' ? '云端供应商' : '本地供应商',
    provider: 'openai',
    base_url: 'https://api.openai.com',
    api_key: '',
    model: 'gpt-4.1-mini',
    balance_url: '',
    balance_method: 'GET',
    balance_headers: '{\n  "Authorization": "Bearer {apiKey}"\n}',
    balance_body: '',
    balance_path: '',
  };
}

function normalizePreset(raw: any, storage: LlmStorage, index: number): LlmPreset {
  return {
    ...createPreset(storage, index),
    ...raw,
    provider: raw?.provider === 'anthropic' ? 'anthropic' : 'openai',
    balance_method: raw?.balance_method === 'POST' ? 'POST' : 'GET',
    balance_headers: raw?.balance_headers ?? '{\n  "Authorization": "Bearer {apiKey}"\n}',
    balance_body: raw?.balance_body ?? '',
    balance_path: raw?.balance_path ?? '',
  };
}

export default function LlmSettings({ flashSaved }: { flashSaved: () => void }) {
  const [cloudPresets, setCloudPresets] = useState<LlmPreset[]>([]);
  const [localPresets, setLocalPresets] = useState<LlmPreset[]>([]);
  const [activeStorage, setActiveStorage] = useState<LlmStorage>('cloud');
  const [activeId, setActiveId] = useState('');
  const [editingStorage, setEditingStorage] = useState<LlmStorage>('cloud');
  const [editingId, setEditingId] = useState('');
  const [testing, setTesting] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(true);

  const currentList = editingStorage === 'cloud' ? cloudPresets : localPresets;
  const editingPreset = currentList.find((preset) => preset.id === editingId) || currentList[0];
  const activePreset = activeStorage === 'cloud'
    ? cloudPresets.find((preset) => preset.id === activeId)
    : localPresets.find((preset) => preset.id === activeId);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await api.settings.getLlmConfig();
      const savedLocal = JSON.parse(localStorage.getItem(LOCAL_LLM_PRESETS_KEY) || '[]');
      const nextCloud = (Array.isArray(config?.cloudPresets) ? config.cloudPresets : [])
        .map((preset: any, index: number) => normalizePreset(preset, 'cloud', index));
      const nextLocal = (Array.isArray(savedLocal) ? savedLocal : [])
        .map((preset: any, index: number) => normalizePreset(preset, 'local', index));
      const savedStorage = localStorage.getItem(ACTIVE_LLM_STORAGE_KEY) as LlmStorage | null;
      const nextActiveStorage = savedStorage === 'local' ? 'local' : 'cloud';
      const nextActiveId = localStorage.getItem(ACTIVE_LLM_ID_KEY) || config?.activeCloudId || nextCloud[0]?.id || nextLocal[0]?.id || '';

      setCloudPresets(nextCloud.length ? nextCloud : [createPreset('cloud', 0)]);
      setLocalPresets(nextLocal);
      setActiveStorage(nextActiveStorage);
      setActiveId(nextActiveId);
      setEditingStorage(nextActiveStorage);
      setEditingId(nextActiveId || nextCloud[0]?.id || nextLocal[0]?.id || '');
    } catch (error) {
      console.error('Failed to load LLM config:', error);
      setCloudPresets([createPreset('cloud', 0)]);
    } finally {
      setLoading(false);
    }
  };

  const updatePreset = (patch: Partial<LlmPreset>) => {
    if (!editingPreset) return;
    const update = (items: LlmPreset[]) => items.map((preset) => (
      preset.id === editingPreset.id ? { ...preset, ...patch } : preset
    ));
    if (editingStorage === 'cloud') setCloudPresets(update);
    else setLocalPresets(update);
  };

  const addPreset = (storage: LlmStorage) => {
    const preset = createPreset(storage, storage === 'cloud' ? cloudPresets.length : localPresets.length);
    if (storage === 'cloud') setCloudPresets((items) => [...items, preset]);
    else setLocalPresets((items) => [...items, preset]);
    setEditingStorage(storage);
    setEditingId(preset.id);
  };

  const deletePreset = () => {
    if (!editingPreset) return;
    const next = currentList.filter((preset) => preset.id !== editingPreset.id);
    if (editingStorage === 'cloud') setCloudPresets(next.length ? next : [createPreset('cloud', 0)]);
    else setLocalPresets(next);
    if (activeId === editingPreset.id) {
      setActiveId('');
      localStorage.removeItem(ACTIVE_LLM_ID_KEY);
    }
    setEditingId(next[0]?.id || '');
  };

  const selectActive = (storage: LlmStorage, id: string) => {
    setActiveStorage(storage);
    setActiveId(id);
    localStorage.setItem(ACTIVE_LLM_STORAGE_KEY, storage);
    localStorage.setItem(ACTIVE_LLM_ID_KEY, id);
  };

  const handleSave = async () => {
    localStorage.setItem(LOCAL_LLM_PRESETS_KEY, JSON.stringify(localPresets));
    localStorage.setItem(ACTIVE_LLM_STORAGE_KEY, activeStorage);
    localStorage.setItem(ACTIVE_LLM_ID_KEY, activeId);
    await api.settings.saveLlmConfig({
      activeCloudId: activeStorage === 'cloud' ? activeId : '',
      cloudPresets: cloudPresets.map((preset) => ({
        ...preset,
        is_active: activeStorage === 'cloud' && preset.id === activeId,
      })),
    });
    flashSaved();
  };

  const handleTest = async () => {
    setTesting(true);
    setResult('');
    try {
      await handleSave();
      await api.chat.plan('连接测试', '这是一个连接测试，请忽略。', []);
      setResult('连接测试成功，当前 AI 配置可以正常工作。');
    } catch (err: any) {
      setResult(`连接测试失败：${err.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleBalance = async () => {
    if (!editingPreset) return;
    setCheckingBalance(true);
    setResult('');
    try {
      const data = await api.settings.getLlmBalance(editingPreset);
      const value = typeof data?.value === 'object' ? JSON.stringify(data.value) : String(data?.value ?? '');
      setResult(`余额查询结果：${value || JSON.stringify(data?.raw)}`);
    } catch (err: any) {
      setResult(`余额查询失败：${err.message || '未知错误'}`);
    } finally {
      setCheckingBalance(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-parchment-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-gold-400" />
          AI 接口配置
        </h3>
        <p className="text-xs text-parchment-400 mt-1">
          预设多个供应商和模型，选择当前使用项，并决定配置保存到云端还是本地。
        </p>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-4">
        <div className="space-y-3">
          {(['cloud', 'local'] as LlmStorage[]).map((storage) => {
            const items = storage === 'cloud' ? cloudPresets : localPresets;
            const Icon = storage === 'cloud' ? Cloud : HardDrive;
            return (
              <div key={storage} className="rounded-lg border border-ink-800/60 bg-ink-950/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-parchment-300 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {storage === 'cloud' ? '云端配置' : '本地配置'}
                  </div>
                  <button onClick={() => addPreset(storage)} className="p-1 rounded-md text-parchment-400 hover:text-gold-400 hover:bg-ink-800/70" title="新增配置">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <div className="text-xs text-parchment-500 py-2">暂无本地配置</div>
                  ) : items.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setEditingStorage(storage);
                        setEditingId(preset.id);
                      }}
                      className={cn(
                        'w-full text-left rounded-md px-2 py-2 text-xs border transition-colors',
                        editingStorage === storage && editingId === preset.id
                          ? 'border-gold-400/50 bg-gold-400/10 text-gold-300'
                          : 'border-transparent text-parchment-300 hover:bg-ink-800/60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{preset.name}</span>
                        {activeStorage === storage && activeId === preset.id && <Check className="w-3.5 h-3.5 text-forest-400 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-parchment-500 truncate">{preset.model}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {editingPreset && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-between">
              <button onClick={() => selectActive(editingStorage, editingPreset.id)} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                设为当前使用
              </button>
              <button onClick={deletePreset} className="btn-ghost text-sm px-3 py-2 flex items-center gap-1 text-red-400 hover:text-red-300">
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-parchment-400 mb-1 block">配置名称</label>
                <input value={editingPreset.name} onChange={(e) => updatePreset({ name: e.target.value })} className="input-field w-full text-sm py-2" />
              </div>
              <div>
                <label className="text-xs text-parchment-400 mb-1 block">供应商类型</label>
                <select value={editingPreset.provider} onChange={(e) => updatePreset({ provider: e.target.value as LlmProvider })} className="input-field w-full text-sm py-2">
                  <option value="openai">OpenAI 兼容</option>
                  <option value="anthropic">Anthropic 兼容</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-parchment-400 mb-1 block">Base URL</label>
              <input value={editingPreset.base_url} onChange={(e) => updatePreset({ base_url: e.target.value })} className="input-field w-full text-sm py-2" placeholder="https://api.openai.com" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-parchment-400 mb-1 block">API Key / Auth Token</label>
                <input type="password" value={editingPreset.api_key} onChange={(e) => updatePreset({ api_key: e.target.value })} className="input-field w-full text-sm py-2" placeholder="sk-..." />
              </div>
              <div>
                <label className="text-xs text-parchment-400 mb-1 block">模型</label>
                <input value={editingPreset.model} onChange={(e) => updatePreset({ model: e.target.value })} className="input-field w-full text-sm py-2" placeholder="gpt-4.1-mini" />
              </div>
            </div>

            <div className="rounded-lg border border-ink-800/60 bg-ink-950/30 p-3 space-y-3">
              <div className="text-xs font-medium text-parchment-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-gold-400" />
                余额查询接口
              </div>
              <div className="grid sm:grid-cols-[110px_1fr] gap-3">
                <select value={editingPreset.balance_method} onChange={(e) => updatePreset({ balance_method: e.target.value as 'GET' | 'POST' })} className="input-field w-full text-sm py-2">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <input value={editingPreset.balance_url} onChange={(e) => updatePreset({ balance_url: e.target.value })} className="input-field w-full text-sm py-2" placeholder="https://example.com/api/balance" />
              </div>
              <textarea value={editingPreset.balance_headers} onChange={(e) => updatePreset({ balance_headers: e.target.value })} className="input-field w-full text-xs py-2 font-mono min-h-[84px]" placeholder='{"Authorization":"Bearer {apiKey}"}' />
              <textarea value={editingPreset.balance_body} onChange={(e) => updatePreset({ balance_body: e.target.value })} className="input-field w-full text-xs py-2 font-mono min-h-[64px]" placeholder="POST body，可留空" />
              <input value={editingPreset.balance_path} onChange={(e) => updatePreset({ balance_path: e.target.value })} className="input-field w-full text-sm py-2" placeholder="JSON 路径，例如 data.balance；留空返回完整响应" />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} className="btn-primary text-sm px-6 py-2 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> 保存配置
        </button>
        <button onClick={handleTest} disabled={testing || !activePreset} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {testing ? '测试中...' : '测试连接'}
        </button>
        <button onClick={handleBalance} disabled={checkingBalance || !editingPreset?.balance_url} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50">
          {checkingBalance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
          查询余额
        </button>
      </div>

      {result && (
        <div className={cn('text-sm p-3 rounded-lg', result.includes('成功') || result.includes('结果') ? 'bg-forest-800/20 text-forest-400' : 'bg-red-500/10 text-red-400')}>
          {result}
        </div>
      )}
    </div>
  );
}
