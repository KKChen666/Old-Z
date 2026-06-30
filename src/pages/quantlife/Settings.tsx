import React, { useState } from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys } from '@/stores/useQuantLifeStore';
import type { QLLlmConfig, QLDimensionDef } from '@/types';
import { cn } from '@/lib/utils';
import { Settings, User, Zap, Plus, Trash2, ArrowUp, ArrowDown, Check, Loader2 } from 'lucide-react';

type SettingsTab = 'profile' | 'dimensions' | 'llm';

export default function SettingsPage() {
  const { progressData, llmConfig, updateProgress, saveProgress, saveLlmConfig, loadLlmConfig } = useQuantLifeStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saved, setSaved] = useState(false);

  if (!progressData) return null;

  const tabs: { key: SettingsTab; icon: React.ElementType; label: string }[] = [
    { key: 'profile', icon: User, label: '个人信息' },
    { key: 'dimensions', icon: Zap, label: '维度管理' },
    { key: 'llm', icon: Zap, label: 'AI 配置' },
  ];

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-gold-400" />
        <h2 className="text-lg font-serif font-bold text-parchment-100">设置中心</h2>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-ink-800/50 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
              activeTab === tab.key
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-parchment-400 hover:text-parchment-200'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        {saved && (
          <span className="ml-auto text-xs text-forest-400 flex items-center gap-1 self-center">
            <Check className="w-3 h-3" /> 已保存
          </span>
        )}
      </div>

      {/* ====== 个人信息 ====== */}
      {activeTab === 'profile' && <ProfileSettings flashSaved={flashSaved} />}

      {/* ====== 维度管理 ====== */}
      {activeTab === 'dimensions' && <DimensionSettings flashSaved={flashSaved} />}

      {/* ====== AI 配置 ====== */}
      {activeTab === 'llm' && <LlmSettings flashSaved={flashSaved} />}
    </div>
  );
}

// ============ 个人信息子组件 ============
function ProfileSettings({ flashSaved }: { flashSaved: () => void }) {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();
  if (!progressData) return null;

  const profile = progressData.meta.profile;
  const [nickname, setNickname] = useState(profile.nickname);
  const [appTitle, setAppTitle] = useState(profile.app_title);
  const [tagline, setTagline] = useState(profile.tagline);
  const [avatarText, setAvatarText] = useState(profile.avatar_text);

  const handleSave = () => {
    updateProgress((draft) => {
      draft.meta.profile.nickname = nickname;
      draft.meta.profile.app_title = appTitle;
      draft.meta.profile.tagline = tagline;
      draft.meta.profile.avatar_text = avatarText.slice(0, 2);
    });
    saveProgress();
    flashSaved();
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-parchment-400 mb-1 block">昵称</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input-field w-full text-sm py-2"
          />
        </div>
        <div>
          <label className="text-xs text-parchment-400 mb-1 block">头像文字（1-2字）</label>
          <input
            type="text"
            value={avatarText}
            onChange={(e) => setAvatarText(e.target.value.slice(0, 2))}
            className="input-field w-full text-sm py-2"
            maxLength={2}
          />
        </div>
        <div>
          <label className="text-xs text-parchment-400 mb-1 block">应用标题</label>
          <input
            type="text"
            value={appTitle}
            onChange={(e) => setAppTitle(e.target.value)}
            className="input-field w-full text-sm py-2"
          />
        </div>
        <div>
          <label className="text-xs text-parchment-400 mb-1 block">个性签名</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="input-field w-full text-sm py-2"
          />
        </div>
      </div>
      <button onClick={handleSave} className="btn-primary text-sm px-6 py-2">
        保存个人信息
      </button>
    </div>
  );
}

// ============ 维度管理子组件 ============
function DimensionSettings({ flashSaved }: { flashSaved: () => void }) {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();
  const [showNew, setShowNew] = useState(false);
  const [newDef, setNewDef] = useState({ key: '', name: '', emoji: '📊', color: '#888888', goal: 2000, baseRate: 50, coeff: 1.0 });

  if (!progressData) return null;

  const defs = progressData.meta.dimensions.defs || {};
  const dimConfig = progressData.meta.ui.dimensionConfig;
  const order = dimConfig.order || Object.keys(defs);
  const enabledByKey = dimConfig.enabledByKey || {};
  const MAX_DIMENSIONS = 8;

  const handleToggle = (key: string) => {
    const currentEnabled = Object.values(enabledByKey).filter(Boolean).length;
    updateProgress((draft) => {
      const enabled = draft.meta.ui.dimensionConfig.enabledByKey;
      if (enabled[key]) {
        enabled[key] = false;
      } else if (currentEnabled < MAX_DIMENSIONS) {
        enabled[key] = true;
      }
    });
    saveProgress();
    flashSaved();
  };

  const handleMove = (key: string, dir: number) => {
    updateProgress((draft) => {
      const ord = draft.meta.ui.dimensionConfig.order;
      const idx = ord.indexOf(key);
      if (idx === -1) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= ord.length) return;
      [ord[idx], ord[newIdx]] = [ord[newIdx], ord[idx]];
    });
    saveProgress();
  };

  const handleAdd = () => {
    if (!newDef.key.trim() || !newDef.name.trim()) return;
    if (defs[newDef.key]) return; // key 已存在

    updateProgress((draft) => {
      draft.meta.dimensions.defs[newDef.key] = {
        key: newDef.key,
        name: newDef.name,
        emoji: newDef.emoji,
        color: newDef.color,
        goal: newDef.goal,
        archived: false,
        exp_config: { base_rate_per_hour: newDef.baseRate, coefficient: newDef.coeff },
      };
      draft.meta.ui.dimensionConfig.order.push(newDef.key);
      draft.meta.ui.dimensionConfig.enabledByKey[newDef.key] = true;
      if (!draft.dimensions[newDef.key]) {
        draft.dimensions[newDef.key] = { total_exp: 0 };
      }
    });

    setShowNew(false);
    setNewDef({ key: '', name: '', emoji: '📊', color: '#888888', goal: 2000, baseRate: 50, coeff: 1.0 });
    saveProgress();
    flashSaved();
  };

  const handleDelete = (key: string) => {
    // 不允许删除默认维度
    const defaultKeys = ['research', 'coding', 'fitness', 'speech', 'media', 'editing', 'makeup', 'tem'];
    if (defaultKeys.includes(key)) return;

    updateProgress((draft) => {
      delete draft.meta.dimensions.defs[key];
      draft.meta.ui.dimensionConfig.order = draft.meta.ui.dimensionConfig.order.filter((k: string) => k !== key);
      delete draft.meta.ui.dimensionConfig.enabledByKey[key];
    });
    saveProgress();
    flashSaved();
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xs text-parchment-400">
          已启用 {Object.values(enabledByKey).filter(Boolean).length}/{MAX_DIMENSIONS} 个维度
        </div>
        <button onClick={() => setShowNew(!showNew)} className="btn-ghost text-sm flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> 新建维度
        </button>
      </div>

      {/* 新建维度表单 */}
      {showNew && (
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input placeholder="Key (英文)" value={newDef.key} onChange={e => setNewDef({...newDef, key: e.target.value})} className="input-field text-sm py-2" />
            <input placeholder="名称" value={newDef.name} onChange={e => setNewDef({...newDef, name: e.target.value})} className="input-field text-sm py-2" />
            <input placeholder="Emoji" value={newDef.emoji} onChange={e => setNewDef({...newDef, emoji: e.target.value})} className="input-field text-sm py-2" />
            <input type="color" value={newDef.color} onChange={e => setNewDef({...newDef, color: e.target.value})} className="w-full h-9 rounded cursor-pointer" />
            <input type="number" placeholder="目标等级" value={newDef.goal} onChange={e => setNewDef({...newDef, goal: parseInt(e.target.value)||2000})} className="input-field text-sm py-2" />
            <input type="number" placeholder="基础经验/小时" value={newDef.baseRate} onChange={e => setNewDef({...newDef, baseRate: parseInt(e.target.value)||50})} className="input-field text-sm py-2" />
            <input type="number" step="0.1" placeholder="系数" value={newDef.coeff} onChange={e => setNewDef({...newDef, coeff: parseFloat(e.target.value)||1.0})} className="input-field text-sm py-2" />
          </div>
          <button onClick={handleAdd} className="btn-primary text-sm px-4 py-2 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> 确认添加
          </button>
        </div>
      )}

      {/* 维度列表 */}
      <div className="space-y-2">
        {order.map((key: string) => {
          const def = defs[key] as QLDimensionDef | undefined;
          if (!def || def.archived) return null;
          const enabled = enabledByKey[key] !== false;
          return (
            <div key={key} className={cn('flex items-center gap-3 p-3 rounded-lg', enabled ? 'bg-ink-800/40' : 'bg-ink-800/20 opacity-50')}>
              <span className="text-xl">{def.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-parchment-200">{def.name}</div>
                <div className="text-xs text-parchment-500">
                  {key} · {def.exp_config.base_rate_per_hour} EXP/h · 系数 {def.exp_config.coefficient}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleMove(key, -1)} disabled={order.indexOf(key) === 0} className="text-parchment-500 hover:text-parchment-200 disabled:opacity-30">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleMove(key, 1)} disabled={order.indexOf(key) === order.length - 1} className="text-parchment-500 hover:text-parchment-200 disabled:opacity-30">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggle(key)}
                  className={cn('text-xs px-2 py-1 rounded ml-1', enabled ? 'bg-forest-800/40 text-forest-400' : 'bg-ink-700 text-parchment-500')}
                >
                  {enabled ? '启用' : '禁用'}
                </button>
                <button onClick={() => handleDelete(key)} className="text-parchment-500 hover:text-red-400 ml-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ AI 配置子组件 ============
function LlmSettings({ flashSaved }: { flashSaved: () => void }) {
  const { llmConfig, saveLlmConfig } = useQuantLifeStore();
  const [provider, setProvider] = useState<'openai' | 'anthropic'>(llmConfig?.provider || 'openai');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(llmConfig?.openai?.base_url || 'https://api.openai.com');
  const [openaiKey, setOpenaiKey] = useState(llmConfig?.openai?.api_key || '');
  const [openaiModel, setOpenaiModel] = useState(llmConfig?.openai?.model || 'gpt-4.1-mini');
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState(llmConfig?.anthropic?.base_url || 'https://api.anthropic.com');
  const [anthropicToken, setAnthropicToken] = useState(llmConfig?.anthropic?.auth_token || '');
  const [anthropicModel, setAnthropicModel] = useState(llmConfig?.anthropic?.model || 'claude-sonnet-4-5');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  const handleSave = async () => {
    const config: QLLlmConfig = {
      provider,
      openai: { base_url: openaiBaseUrl, api_key: openaiKey, model: openaiModel },
      anthropic: { base_url: anthropicBaseUrl, auth_token: anthropicToken, model: anthropicModel },
    };
    await saveLlmConfig(config);
    flashSaved();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('');
    try {
      // 先保存配置
      await handleSave();
      const { api } = await import('@/utils/api');
      await api.quantlife.ingestText(
        `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`,
        '测试：看了一小时书'
      );
      setTestResult('✅ 连接测试成功！AI 接口正常工作');
    } catch (err: any) {
      setTestResult(`❌ 测试失败：${err.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      {/* 提供商选择 */}
      <div>
        <label className="text-xs text-parchment-400 mb-2 block">AI 提供商</label>
        <div className="flex gap-2">
          <button
            onClick={() => setProvider('openai')}
            className={cn('px-4 py-2 rounded-lg text-sm', provider === 'openai' ? 'bg-gold-400/20 text-gold-400 border border-gold-400/50' : 'bg-ink-800/50 text-parchment-400')}
          >
            OpenAI 兼容
          </button>
          <button
            onClick={() => setProvider('anthropic')}
            className={cn('px-4 py-2 rounded-lg text-sm', provider === 'anthropic' ? 'bg-gold-400/20 text-gold-400 border border-gold-400/50' : 'bg-ink-800/50 text-parchment-400')}
          >
            Anthropic 兼容
          </button>
        </div>
      </div>

      {/* OpenAI 配置 */}
      {provider === 'openai' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">Base URL</label>
            <input type="text" value={openaiBaseUrl} onChange={e => setOpenaiBaseUrl(e.target.value)} className="input-field w-full text-sm py-2" placeholder="https://api.openai.com" />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">API Key</label>
            <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} className="input-field w-full text-sm py-2" placeholder="sk-..." />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">Model</label>
            <input type="text" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} className="input-field w-full text-sm py-2" placeholder="gpt-4.1-mini" />
          </div>
        </div>
      )}

      {/* Anthropic 配置 */}
      {provider === 'anthropic' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">Base URL</label>
            <input type="text" value={anthropicBaseUrl} onChange={e => setAnthropicBaseUrl(e.target.value)} className="input-field w-full text-sm py-2" placeholder="https://api.anthropic.com" />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">Auth Token</label>
            <input type="password" value={anthropicToken} onChange={e => setAnthropicToken(e.target.value)} className="input-field w-full text-sm py-2" placeholder="sk-ant-..." />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">Model</label>
            <input type="text" value={anthropicModel} onChange={e => setAnthropicModel(e.target.value)} className="input-field w-full text-sm py-2" placeholder="claude-sonnet-4-5" />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={handleSave} className="btn-primary text-sm px-6 py-2 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> 保存配置
        </button>
        <button onClick={handleTest} disabled={testing} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {testing ? '测试中...' : '测试连接'}
        </button>
      </div>

      {testResult && (
        <div className={cn('text-sm p-3 rounded-lg', testResult.startsWith('✅') ? 'bg-forest-800/20 text-forest-400' : 'bg-red-500/10 text-red-400')}>
          {testResult}
        </div>
      )}
    </div>
  );
}
