import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Cloud,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Loader2,
  RotateCcw,
  Server,
  X,
  Zap,
} from 'lucide-react';
import { api, getDefaultApiBase, getEffectiveApiBase, saveAuth, syncTokenToNative } from '@/utils/api';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from '@/components/Toast';
import { supportsLocalMode } from '@/utils/runtime';

type AuthTab = 'login' | 'register' | 'reset';

export default function Login() {
  const navigate = useNavigate();
  const localModeAvailable = supportsLocalMode();
  const { setUser } = useAppStore(useShallow((state) => ({ setUser: state.setUser })));
  const [view, setView] = useState<'online' | 'local'>('online');
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const [showBackendSettings, setShowBackendSettings] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [customApiBase, setCustomApiBase] = useState('');
  const [backendSaved, setBackendSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    setCustomApiBase(localStorage.getItem('old-z-api-base') || '');
    if (!localModeAvailable) {
      setView('online');
      localStorage.removeItem('old-z-local-mode');
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startLongPress = (event: React.PointerEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    progressRef.current = 0;
    timerRef.current = setInterval(() => {
      progressRef.current += 1;
      if (progressRef.current >= 100) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setLongPressProgress(0);
        setShowBackendSettings(true);
        setBackendSaved(false);
        setCustomApiBase(localStorage.getItem('old-z-api-base') || '');
      } else if (progressRef.current >= 50) {
        setLongPressProgress((progressRef.current - 50) * 2);
      }
    }, 100);
  };

  const cancelLongPress = (event: React.PointerEvent) => {
    event.preventDefault();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setLongPressProgress(0);
  };

  const persistBackendUrl = (reset = false) => {
    const value = reset ? '' : customApiBase.trim();
    if (value) localStorage.setItem('old-z-api-base', value);
    else localStorage.removeItem('old-z-api-base');
    if (reset) setCustomApiBase('');
    setBackendSaved(true);
    setTimeout(() => window.location.reload(), 800);
  };

  const switchTab = (nextTab: AuthTab) => {
    setTab(nextTab);
    setError('');
    setPassword('');
    setOldPassword('');
    setConfirmPassword('');
    setDisplayName('');
  };

  const validate = () => {
    if (username.length < 3) return '用户名至少 3 个字符';
    if (tab === 'reset' && oldPassword.length < 6) return '旧密码至少 6 个字符';
    if (password.length < 6) return tab === 'reset' ? '新密码至少 6 个字符' : '密码至少 6 个字符';
    if (tab !== 'login' && password !== confirmPassword) return '两次密码输入不一致';
    return null;
  };

  const completeOnlineAuth = async (response: { token: string; user: any }) => {
    saveAuth(response.token);
    syncTokenToNative(response.token);
    setUser(response.user);

    if (localModeAvailable && localStorage.getItem('old-z-local-mode') === 'true') {
      const shouldMerge = window.confirm('检测到本地模式数据，是否合并到当前账户？\n\n云端数据不会被覆盖。');
      if (shouldMerge) {
        try {
          const result = await api.mergeLocal();
          if (result.merged || result.skipped) {
            alert(`合并完成：已迁移 ${result.merged} 条，跳过 ${result.skipped} 条。`);
          }
        } catch {
          toast.warning('账户已登录，但本地数据合并失败，可稍后重试');
        }
      }
    }

    localStorage.removeItem('old-z-local-mode');
    navigate('/');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast.warning(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = tab === 'login'
        ? await api.login(username, password)
        : tab === 'register'
          ? await api.register(username, password, displayName || undefined)
          : await api.resetPassword(username, oldPassword, password);
      await completeOnlineAuth(response);
    } catch (authError: any) {
      const message = authError.message || '操作失败，请重试';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalMode = async () => {
    if (!localModeAvailable) return;
    setLocalLoading(true);
    try {
      const response = await api.localLogin();
      saveAuth(response.token);
      syncTokenToNative(response.token);
      setUser(response.user);
      localStorage.setItem('old-z-local-mode', 'true');
      navigate('/');
    } catch (localError: any) {
      toast.error(`本地模式初始化失败：${localError.message || '未知错误'}`);
    } finally {
      setLocalLoading(false);
    }
  };

  const ringCircumference = 2 * Math.PI * 28;

  return (
    <main className="animated-login-page login-min-h-mobile">
      <section
        className={`animated-login ${view === 'local' ? 'is-local' : ''} ${localModeAvailable ? '' : 'is-online-only'}`}
        aria-label={localModeAvailable ? '模式选择' : '在线登录'}
      >
        {localModeAvailable && <div className="animated-login__form animated-login__local">
          <div className="animated-login__local-content">
            <span className="animated-login__mode-icon"><HardDrive size={30} /></span>
            <h1>本地模式</h1>
            <p>数据仅保存在当前设备</p>
            <button type="button" className="animated-login__primary" onClick={handleLocalMode} disabled={localLoading}>
              {localLoading ? <><Loader2 className="animate-spin" size={17} />正在进入</> : <>进入系统<ArrowRight size={17} /></>}
            </button>
          </div>
        </div>}

        <div className="animated-login__form animated-login__online">
          <form onSubmit={handleSubmit}>
            <button
              type="button"
              className="animated-login__brand"
              aria-label="Old Z"
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span><Zap size={19} />{longPressProgress > 0 && <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" strokeDasharray={ringCircumference} strokeDashoffset={ringCircumference * (1 - longPressProgress / 100)} /></svg>}</span>
              <strong>Old Z</strong>
            </button>

            <h1>{tab === 'login' ? '在线登录' : tab === 'register' ? '创建账户' : '重置密码'}</h1>
            <p className="animated-login__hint">{tab === 'reset' ? '验证旧密码并设置新密码' : '登录后同步你的知识与记录'}</p>

            {error && <div className="animated-login__error">{error}</div>}
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用户名" autoComplete="username" />
            {tab === 'register' && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="显示名称（选填）" autoComplete="name" />}
            {tab === 'reset' && <input type={showPassword ? 'text' : 'password'} value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="旧密码" autoComplete="current-password" />}
            <span className="animated-login__password"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={tab === 'reset' ? '新密码' : '密码'} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} /><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
            {tab !== 'login' && <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="确认密码" autoComplete="new-password" />}

            {tab === 'login' && <button type="button" className="animated-login__text-button" onClick={() => switchTab('reset')}><KeyRound size={12} />忘记密码？</button>}
            <button type="submit" className="animated-login__primary" disabled={loading}>{loading ? <><Loader2 className="animate-spin" size={17} />请稍候</> : <>{tab === 'login' ? '登录' : tab === 'register' ? '注册' : '更新密码'}</>}</button>
            <button type="button" className="animated-login__switch-auth" onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}>{tab === 'login' ? '没有账户？立即注册' : '已有账户？返回登录'}</button>
          </form>
        </div>

        {localModeAvailable && <div className="animated-login__toggle-wrap">
          <div className="animated-login__toggle">
            <div className="animated-login__toggle-panel animated-login__toggle-left">
              <span className="animated-login__mode-icon"><Cloud size={28} /></span>
              <h2>在线模式</h2>
              <p>登录账户，在不同设备间同步数据</p>
              <button type="button" onClick={() => setView('online')}>切换到在线模式</button>
            </div>
            <div className="animated-login__toggle-panel animated-login__toggle-right">
              <span className="animated-login__mode-icon"><HardDrive size={28} /></span>
              <h2>本地模式</h2>
              <p>无需注册，数据保存在当前设备</p>
              <button type="button" onClick={() => setView('local')}>切换到本地模式</button>
            </div>
          </div>
        </div>}
      </section>

      {showBackendSettings && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="后端服务器设置"><div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl"><div className="mb-5 flex items-center gap-3"><Server className="text-gold-400" size={20} /><div><h2 className="text-base font-semibold text-parchment-100">后端服务器设置</h2><p className="text-xs text-ink-400">自定义 API 连接地址</p></div><button type="button" className="ml-auto text-ink-400 hover:text-parchment-100" onClick={() => setShowBackendSettings(false)} aria-label="关闭"><X size={18} /></button></div><div className="space-y-2 rounded-lg bg-ink-950/60 p-3 text-xs"><p className="text-ink-400">当前：<code className="text-parchment-300">{getEffectiveApiBase()}</code></p><p className="text-ink-400">默认：<code className="text-parchment-300">{getDefaultApiBase()}</code></p></div><input className="input-field mt-4 text-sm" value={customApiBase} onChange={(event) => { setCustomApiBase(event.target.value); setBackendSaved(false); }} placeholder="http://192.168.1.100:3001/api" /><div className="mt-4 flex gap-2"><button type="button" className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm" disabled={backendSaved} onClick={() => persistBackendUrl()}><Check size={15} />{backendSaved ? '已保存' : '保存并刷新'}</button><button type="button" className="btn-ghost flex items-center gap-2 text-sm" disabled={backendSaved} onClick={() => persistBackendUrl(true)}><RotateCcw size={15} />恢复默认</button></div></div></div>}
    </main>
  );
}
