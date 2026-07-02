import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/utils/api';
import { Settings, Zap, Check, Loader2, User, Lock, LogOut, Palette, Moon, Sun, Plus, Trash2, Cloud, HardDrive, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Theme, useTheme } from '@/hooks/useTheme';
import AdvancedLlmSettings from '@/components/settings/LlmSettings';

type SettingsTab = 'user' | 'llm';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('user');
  const [saved, setSaved] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto p-4 sm:p-6">
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
        <button
          onClick={() => setActiveTab('user')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
            activeTab === 'user'
              ? 'border-gold-400 text-gold-400'
              : 'border-transparent text-parchment-400 hover:text-parchment-200'
          )}
        >
          <User className="w-3.5 h-3.5" />
          用户设置
        </button>
        <button
          onClick={() => setActiveTab('llm')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-[1px] transition-all',
            activeTab === 'llm'
              ? 'border-gold-400 text-gold-400'
              : 'border-transparent text-parchment-400 hover:text-parchment-200'
          )}
        >
          <Zap className="w-3.5 h-3.5" />
          AI 配置
        </button>
      </div>

      {activeTab === 'user' ? <UserSettings flashSaved={flashSaved} /> : <AdvancedLlmSettings flashSaved={flashSaved} />}
    </div>
  );
}

// ============ 用户设置 ============
function UserSettings({ flashSaved }: { flashSaved: () => void }) {
  const { user, setUser, logout } = useAppStore();
  const { theme, setTheme } = useTheme();
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
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
          <Palette className="w-4 h-4 text-gold-400" />
          外观主题
        </h3>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-950/50 p-1 border border-ink-800/50">
          {[
            { value: 'dark' as Theme, label: '经典暗色', icon: Moon },
            { value: 'mimo' as Theme, label: 'MiMo 暖白', icon: Sun },
          ].map((item) => {
            const Icon = item.icon;
            const active = theme === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTheme(item.value)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-gold-400 text-ink-950 shadow-sm shadow-gold-400/20'
                    : 'text-parchment-400 hover:bg-ink-800/60 hover:text-parchment-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

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
