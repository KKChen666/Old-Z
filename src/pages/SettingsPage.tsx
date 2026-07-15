import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { api } from '@/utils/api';
import { Settings, Zap, Check, Loader2, User, Lock, LogOut, Palette, Moon, Sun, Plus, Trash2, Cloud, HardDrive, Wallet, Key, Copy, Eye, EyeOff, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Theme, useTheme } from '@/hooks/useTheme';
import AdvancedLlmSettings from '@/components/settings/LlmSettings';

type SettingsTab = 'user' | 'appearance' | 'llm' | 'sync';

type LlmStorage = 'cloud' | 'local';
type LlmProvider = 'openai' | 'anthropic';

interface LlmConfig {
  provider: LlmProvider;
  openai: { base_url: string; api_key: string; model: string };
  anthropic: { base_url: string; auth_token: string; model: string };
}

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

export default function SettingsPage() {
  const user = useAppStore((s) => s.user);
  const isLocalUser = user?.username === 'local-user';
  const [activeTab, setActiveTab] = useState<SettingsTab>(isLocalUser ? 'appearance' : 'user');
  const [saved, setSaved] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-gold-400" />
        <h2 className="text-lg font-serif font-bold text-parchment-100">设置</h2>
        {saved && (
          <span className="text-xs text-forest-400 flex items-center gap-1 ml-auto">
            <Check className="w-3 h-3" /> 已保存
          </span>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-ink-800/50 pb-0">
        {!isLocalUser && (
          <button onClick={() => setActiveTab('user')}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
              activeTab === 'user' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200')}>
            <User className="w-3.5 h-3.5" /> 用户设置
          </button>
        )}
        <button onClick={() => setActiveTab('appearance')}
          className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
            activeTab === 'appearance' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200')}>
          <Palette className="w-3.5 h-3.5" /> 外观与应用
        </button>
        <button onClick={() => setActiveTab('llm')}
          className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
            activeTab === 'llm' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200')}>
          <Zap className="w-3.5 h-3.5" /> AI 配置
        </button>
        {!isLocalUser && (
          <button onClick={() => setActiveTab('sync')}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
              activeTab === 'sync' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200')}>
            <Cloud className="w-3.5 h-3.5" /> 远端密钥
          </button>
        )}
      </div>

      {activeTab === 'user' && !isLocalUser && <UserSettings flashSaved={flashSaved} />}
      {activeTab === 'appearance' && <AppearanceSettings flashSaved={flashSaved} />}
      {activeTab === 'llm' && <AdvancedLlmSettings flashSaved={flashSaved} localOnly={isLocalUser} />}
      {activeTab === 'sync' && !isLocalUser && <SyncKeySettings flashSaved={flashSaved} />}
    </div>
  );
}

function AppearanceSettings({ flashSaved }: { flashSaved: () => void }) {
  const { theme, setTheme } = useTheme();
  const electronAPI = window.electronAPI;
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(!!electronAPI);
  const [autoStartError, setAutoStartError] = useState('');
  const options = [
    { value: 'dark' as Theme, label: '经典暗色', description: '深色背景，适合夜间和长时间专注', icon: Moon, preview: 'bg-[#111313]' },
    { value: 'mimo' as Theme, label: '暖白', description: '温暖纸张质感，适合白天阅读与整理', icon: Sun, preview: 'bg-[#f2ead8]' },
  ];

  const selectTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    flashSaved();
  };

  useEffect(() => {
    if (!electronAPI) return;

    let active = true;
    electronAPI.getAutoStart()
      .then((enabled) => {
        if (active) setAutoStart(enabled);
      })
      .catch(() => {
        if (active) setAutoStartError('无法读取开机自启动状态');
      })
      .finally(() => {
        if (active) setAutoStartLoading(false);
      });

    return () => {
      active = false;
    };
  }, [electronAPI]);

  const toggleAutoStart = async () => {
    if (!electronAPI || autoStartLoading) return;

    setAutoStartLoading(true);
    setAutoStartError('');
    try {
      const enabled = await electronAPI.setAutoStart(!autoStart);
      setAutoStart(enabled);
      flashSaved();
    } catch {
      setAutoStartError('修改开机自启动设置失败');
    } finally {
      setAutoStartLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
            <Palette className="h-4 w-4 text-gold-400" /> 外观主题
          </h3>
          <p className="mt-1 text-xs text-ink-500">主题保存在当前设备，切换后立即生效，不需要在线账户。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map(item => {
            const Icon = item.icon;
            const active = theme === item.value;
            return (
              <button key={item.value} type="button" onClick={() => selectTheme(item.value)}
                className={cn('overflow-hidden rounded-xl border text-left transition-all', active ? 'border-gold-400/60 bg-gold-400/10 ring-1 ring-gold-400/20' : 'border-ink-800/60 bg-ink-950/40 hover:border-ink-700')}>
                <span className={cn('block h-20 border-b border-ink-800/40 p-3', item.preview)}>
                  <span className="flex h-full gap-2 rounded-lg border border-black/10 bg-black/10 p-2">
                    <span className="w-8 rounded bg-black/20" />
                    <span className="flex-1 space-y-1.5 pt-1"><span className="block h-2 w-2/3 rounded bg-current opacity-30" /><span className="block h-2 w-full rounded bg-current opacity-15" /><span className="block h-2 w-4/5 rounded bg-current opacity-15" /></span>
                  </span>
                </span>
                <span className="flex items-start gap-3 p-3">
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-gold-300' : 'text-ink-500')} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-parchment-100">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-ink-500">{item.description}</span></span>
                  {active && <Check className="h-4 w-4 shrink-0 text-gold-300" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {electronAPI && (
        <div className="glass-card p-5">
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
              <Rocket className="h-4 w-4 text-gold-400" /> 应用行为
            </h3>
            <p className="mt-1 text-xs text-ink-500">这些设置仅保存在当前电脑。</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoStart}
            disabled={autoStartLoading}
            onClick={toggleAutoStart}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-ink-800/60 bg-ink-950/40 p-4 text-left transition-colors hover:border-ink-700 disabled:cursor-wait disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-medium text-parchment-100">开机自启动</span>
              <span className="mt-1 block text-xs text-ink-500">登录系统后自动启动 Old Z</span>
            </span>
            <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', autoStart ? 'bg-gold-400' : 'bg-ink-700')}>
              <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', autoStart ? 'translate-x-6' : 'translate-x-1')} />
            </span>
          </button>
          {autoStartError && <p className="mt-2 text-xs text-red-400">{autoStartError}</p>}
        </div>
      )}
    </div>
  );
}

// ============ 用户设置 ============
function UserSettings({ flashSaved }: { flashSaved: () => void }) {
  const { user, setUser, logout } = useAppStore(useShallow((s) => ({
    user: s.user,
    setUser: s.setUser,
    logout: s.logout,
  })));
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (user?.displayName) setNickname(user.displayName);
  }, [user?.displayName]);

  const handleSaveProfile = async () => {
    setProfileError('');
    if (!username.trim() || username.trim().length < 3) {
      setProfileError('用户名至少需要 3 个字符');
      return;
    }
    if (!nickname.trim()) {
      setProfileError('请输入昵称');
      return;
    }
    setSaving(true);
    try {
      const updates: { username?: string; displayName?: string } = {};
      if (username.trim() !== user?.username) updates.username = username.trim();
      if (nickname.trim() !== user?.displayName) updates.displayName = nickname.trim();

      if (Object.keys(updates).length === 0) {
        setSaving(false);
        return;
      }

      const updated = await api.updateProfile(updates);
      setUser({ ...user!, username: updated.username, displayName: updated.displayName });
      flashSaved();
    } catch (err: any) {
      setProfileError(err.message || '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');

    if (!oldPassword) {
      setPwError('请输入旧密码');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPwError('新密码长度至少为 6 个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('两次输入的新密码不一致');
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPwSuccess('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || '密码修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 个人信息 */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
          <User className="w-4 h-4 text-gold-400" />
          个人信息
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
              placeholder="3-50 个字符"
              className="input-field w-full text-sm py-2"
              maxLength={50}
            />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
              placeholder="输入昵称..."
              className="input-field w-full text-sm py-2"
              maxLength={50}
            />
          </div>

          {profileError && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{profileError}</div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="btn-primary text-sm px-6 py-2 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            保存修改
          </button>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gold-400" />
          修改密码
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">旧密码</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="input-field w-full text-sm py-2"
              placeholder="输入当前密码"
            />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field w-full text-sm py-2"
              placeholder="至少 6 个字符"
            />
          </div>
          <div>
            <label className="text-xs text-parchment-400 mb-1 block">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field w-full text-sm py-2"
              placeholder="再次输入新密码"
            />
          </div>

          {pwError && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="text-sm text-forest-400 bg-forest-800/20 rounded-lg p-3">{pwSuccess}</div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="btn-primary text-sm px-6 py-2 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            修改密码
          </button>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="glass-card p-5 space-y-4 border-red-500/10">
        <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          退出登录
        </h3>
        <p className="text-xs text-parchment-400">
          退出后需要重新输入用户名和密码才能登录
        </p>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  );
}

// ============ AI 配置 ============
function LlmSettings({ flashSaved }: { flashSaved: () => void }) {
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4.1-mini');
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState('https://api.anthropic.com');
  const [anthropicToken, setAnthropicToken] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4-5');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await api.settings.getLlmConfig();
      if (config) {
        setProvider(config.provider || 'openai');
        setOpenaiBaseUrl(config.openai?.base_url || 'https://api.openai.com');
        setOpenaiKey(config.openai?.api_key || '');
        setOpenaiModel(config.openai?.model || 'gpt-4.1-mini');
        setAnthropicBaseUrl(config.anthropic?.base_url || 'https://api.anthropic.com');
        setAnthropicToken(config.anthropic?.auth_token || '');
        setAnthropicModel(config.anthropic?.model || 'claude-sonnet-4-5');
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const config: LlmConfig = {
      provider,
      openai: { base_url: openaiBaseUrl, api_key: openaiKey, model: openaiModel },
      anthropic: { base_url: anthropicBaseUrl, auth_token: anthropicToken, model: anthropicModel },
    };
    await api.settings.saveLlmConfig(config);
    flashSaved();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('');
    try {
      await handleSave();
      await api.chat.plan('测试目标', '这是一个连接测试，请忽略', []);
      setTestResult('✅ 连接测试成功！AI 接口正常工作');
    } catch (err: any) {
      setTestResult(`❌ 测试失败：${err.message || '未知错误'}`);
    } finally {
      setTesting(false);
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
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
        <Zap className="w-4 h-4 text-gold-400" />
        AI 接口配置
      </h3>
      <p className="text-xs text-parchment-400">
        配置 AI 提供商以使用 AI 聊天和 AI 规划功能
      </p>

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

// ============ 同步密钥管理 ============

function SyncKeySettings({ flashSaved }: { flashSaved: () => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [label, setLabel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadKeys = async () => {
    try {
      const data = await (api.settings as any).getSyncKeys();
      setKeys(Array.isArray(data) ? data : data?.data || []);
    } catch {}
  };

  useEffect(() => { loadKeys(); }, []);

  const generateKey = async () => {
    setLoading(true);
    try {
      const result = await (api.settings as any).generateSyncKey(label);
      setNewKey(result.key);
      flashSaved();
      loadKeys();
    } catch (e: any) {
      alert('生成失败：' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('确定删除此密钥？使用该密钥的本地设备将无法同步。')) return;
    try {
      await (api.settings as any).deleteSyncKey(id);
      loadKeys();
    } catch {}
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKey).then(() => alert('已复制到剪贴板'));
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-ink-800/50 bg-ink-900/60">
        <h3 className="text-sm font-medium text-parchment-100 mb-3">生成同步密钥</h3>
        <p className="text-xs text-parchment-400 mb-4">
          生成后把密钥发给本地设备，在本地模式中填入即可同步笔记。
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text" value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="密钥标签（如：笔记本、手机）"
            className="flex-1 px-3 py-2 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-sm placeholder-ink-500 outline-none focus:border-gold-400/60"
          />
          <button
            onClick={generateKey} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <Key className="w-4 h-4" />
            生成
          </button>
        </div>

        {newKey && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-amber-400 font-medium">新密钥（仅显示一次，请立即复制）</span>
              <button onClick={() => setShowKey(!showKey)} className="text-ink-500 hover:text-parchment-300">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-parchment-100 bg-ink-950/80 px-3 py-2 rounded break-all select-all">
                {showKey ? newKey : newKey.slice(0, 20) + '••••••••••••••••'}
              </code>
              <button onClick={copyKey} className="p-2 text-ink-500 hover:text-parchment-200 rounded-lg hover:bg-ink-800/50">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {keys.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-parchment-100">已有密钥</h3>
          {keys.map((k: any) => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-ink-800/50 bg-ink-900/60">
              <Key className="w-4 h-4 text-ink-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-parchment-100">{k.label}</p>
                <p className="text-[10px] text-ink-500">创建于 {new Date(k.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => deleteKey(k.id)}
                className="p-1.5 text-ink-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
