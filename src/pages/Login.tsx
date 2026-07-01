import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Eye, EyeOff, Zap, KeyRound, Server, X, Check, RotateCcw } from 'lucide-react';
import { api, saveAuth, syncTokenToNative, getEffectiveApiBase, getDefaultApiBase } from '@/utils/api';
import { useAppStore } from '@/stores/useAppStore';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  const [tab, setTab] = useState<'login' | 'register' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 长按 Logo 10 秒设置后端地址（调试入口，对普通用户隐藏）
  const [showBackendSettings, setShowBackendSettings] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [customApiBase, setCustomApiBase] = useState('');
  const [backendSaved, setBackendSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  // 加载已保存的后端地址
  useEffect(() => {
    const saved = localStorage.getItem('old-z-api-base');
    if (saved) setCustomApiBase(saved);
  }, []);

  // 组件卸载时清除计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startLongPress = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    progressRef.current = 0;
    setLongPressProgress(0);
    timerRef.current = setInterval(() => {
      progressRef.current += 1;
      // 前 50 步（5 秒）静默，之后 50 步（5 秒）显示进度环
      if (progressRef.current >= 100) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setLongPressProgress(0);
        setShowBackendSettings(true);
        setBackendSaved(false);
        setCustomApiBase(localStorage.getItem('old-z-api-base') || '');
        return;
      }
      // 第 5 秒后才开始显示进度（50-100 映射到 0-100）
      if (progressRef.current >= 50) {
        setLongPressProgress((progressRef.current - 50) * 2);
      }
    }, 100); // 100 × 100ms = 10 秒总长按
  };

  const cancelLongPress = (e: React.PointerEvent) => {
    e.preventDefault();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLongPressProgress(0);
  };

  // 进度环参数
  const ringR = 30;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - longPressProgress / 100);

  const saveBackendUrl = () => {
    const trimmed = customApiBase.trim();
    if (trimmed) {
      localStorage.setItem('old-z-api-base', trimmed);
    } else {
      localStorage.removeItem('old-z-api-base');
    }
    setBackendSaved(true);
    // 延迟刷新，让用户看到"已保存"的反馈
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const resetBackendUrl = () => {
    localStorage.removeItem('old-z-api-base');
    setCustomApiBase('');
    setBackendSaved(true);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const closeBackendSettings = () => {
    setShowBackendSettings(false);
    setLongPressProgress(0);
  };

  const validate = (): string | null => {
    if (tab === 'reset') {
      if (username.length < 3) return '用户名至少 3 个字符';
      if (password.length < 6) return '新密码至少 6 个字符';
      if (password !== confirmPassword) return '两次密码输入不一致';
      return null;
    }
    if (username.length < 3) return '用户名至少 3 个字符';
    if (password.length < 6) return '密码至少 6 个字符';
    if (tab === 'register' && password !== confirmPassword) return '两次密码输入不一致';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await api.login(username, password);
        saveAuth(res.token);
        syncTokenToNative(res.token);
        setUser(res.user);
        navigate('/');
      } else if (tab === 'register') {
        const res = await api.register(username, password, displayName || undefined);
        saveAuth(res.token);
        syncTokenToNative(res.token);
        setUser(res.user);
        navigate('/');
      } else {
        const res = await api.resetPassword(username, password);
        saveAuth(res.token);
        syncTokenToNative(res.token);
        setUser(res.user);
        navigate('/');
      }
    } catch (e: any) {
      setError(e.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: 'login' | 'register' | 'reset') => {
    setTab(t);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
  };

  return (
    <div className="flex items-center justify-center bg-ink-950 relative min-h-screen login-min-h-mobile">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-forest-800/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gold-400/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-forest-900/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 safe-area-pb">
        {/* Logo — 长按 10 秒设置后端地址（调试入口） */}
        <div className="text-center mb-8">
          <div
            className="relative w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center mb-4 shadow-lg shadow-gold-400/20 select-none transition-shadow duration-300"
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* 长按进度环 */}
            {longPressProgress > 0 && (
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r={ringR}
                  fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                  className="text-gold-400/80"
                />
              </svg>
            )}
            <Zap className="w-8 h-8 text-ink-950 pointer-events-none" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-parchment-100 tracking-wide">
            Old Z
          </h1>
          <p className="text-sm text-parchment-400 mt-2">
            AI 驱动的个人知识管理
          </p>
        </div>

        {/* Backend settings panel — 长按 Logo 10 秒后显示 */}
        {showBackendSettings ? (
          <div className="p-6 rounded-2xl border border-gold-400/20 bg-ink-900/95 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-forest-800/30 flex items-center justify-center">
                <Server className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-parchment-100">后端服务器设置</h2>
                <p className="text-xs text-parchment-400">自定义 API 服务器地址</p>
              </div>
              <button
                onClick={closeBackendSettings}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-ink-500 hover:text-parchment-200 hover:bg-ink-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 当前生效地址 */}
            <div className="mb-4 px-3 py-2 rounded-lg bg-ink-950/50 border border-ink-700/30">
              <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-0.5">当前后端地址</p>
              <p className="text-xs text-parchment-300 font-mono break-all">
                {getEffectiveApiBase()}
              </p>
            </div>

            {/* 默认地址 */}
            <div className="mb-4 px-3 py-2 rounded-lg bg-ink-950/50 border border-ink-700/30">
              <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-0.5">默认地址</p>
              <p className="text-xs text-parchment-400 font-mono break-all">
                {getDefaultApiBase()}
              </p>
            </div>

            {/* 自定义地址输入 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-parchment-400 mb-1.5">
                自定义后端地址
              </label>
              <input
                type="text"
                value={customApiBase}
                onChange={(e) => {
                  setCustomApiBase(e.target.value);
                  setBackendSaved(false);
                }}
                placeholder="例如: http://192.168.1.100:3001/api"
                className="w-full px-4 py-2.5 bg-ink-900/80 border border-ink-700/50 rounded-lg text-parchment-100 placeholder-ink-500 text-sm font-mono outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-all duration-200"
              />
              <p className="text-[10px] text-ink-500 mt-1.5">
                留空则使用默认地址。修改后页面将自动刷新。
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={saveBackendUrl}
                disabled={backendSaved}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-ink-950 font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-gold-400/10 text-sm"
              >
                {backendSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    已保存
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    保存并刷新
                  </>
                )}
              </button>
              <button
                onClick={resetBackendUrl}
                disabled={backendSaved}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-ink-700/50 text-parchment-400 hover:text-parchment-200 hover:border-ink-600/50 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                恢复默认
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Card - 去掉 backdrop-blur 以修复 Android WebView 中的点击穿透问题 */}
            <div className="p-6 rounded-2xl border border-ink-700/30 bg-ink-900/95">
          {/* Tabs */}
          {tab !== 'reset' && (
            <div className="flex mb-6 bg-ink-900/60 rounded-xl p-1">
              <button
                onClick={() => switchTab('login')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === 'login'
                    ? 'bg-forest-800/50 text-gold-400 shadow-sm'
                    : 'text-parchment-400 hover:text-parchment-200'
                }`}
              >
                <LogIn className="w-4 h-4" />
                登录
              </button>
              <button
                onClick={() => switchTab('register')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === 'register'
                    ? 'bg-forest-800/50 text-gold-400 shadow-sm'
                    : 'text-parchment-400 hover:text-parchment-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                注册
              </button>
            </div>
          )}

          {/* Reset password header */}
          {tab === 'reset' && (
            <div className="mb-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-forest-800/30 flex items-center justify-center mb-3">
                <KeyRound className="w-6 h-6 text-gold-400" />
              </div>
              <h2 className="text-lg font-semibold text-parchment-100">重置密码</h2>
              <p className="text-xs text-parchment-400 mt-1">输入用户名和新密码来重置账户密码</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mb-4 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm animate-fade-in">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-parchment-400 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
                className="w-full px-4 py-2.5 bg-ink-900/80 border border-ink-700/50 rounded-lg text-parchment-100 placeholder-ink-500 text-sm outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-all duration-200"
              />
            </div>

            {/* Display name (register only) */}
            {tab === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium text-parchment-400 mb-1.5">
                  显示名称 <span className="text-ink-500">（选填）</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="给自己取个名字吧"
                  autoComplete="name"
                  className="w-full px-4 py-2.5 bg-ink-900/80 border border-ink-700/50 rounded-lg text-parchment-100 placeholder-ink-500 text-sm outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-all duration-200"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-parchment-400 mb-1.5">
                {tab === 'reset' ? '新密码' : '密码'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'reset' ? '请输入新密码' : '请输入密码'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full px-4 py-2.5 pr-12 bg-ink-900/80 border border-ink-700/50 rounded-lg text-parchment-100 placeholder-ink-500 text-sm outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-ink-500 hover:text-parchment-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password (register & reset) */}
            {(tab === 'register' || tab === 'reset') && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium text-parchment-400 mb-1.5">
                  确认密码
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 bg-ink-900/80 border border-ink-700/50 rounded-lg text-parchment-100 placeholder-ink-500 text-sm outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-all duration-200"
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-ink-950 font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-gold-400/10"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" />
              ) : (
                <>
                  {tab === 'login' && <LogIn className="w-4 h-4" />}
                  {tab === 'register' && <UserPlus className="w-4 h-4" />}
                  {tab === 'reset' && <KeyRound className="w-4 h-4" />}
                  {tab === 'login' ? '登录' : tab === 'register' ? '注册' : '重置密码'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-ink-500 mt-6">
          {tab === 'login' && '还没有账号？'}
          {tab === 'register' && '已有账号？'}
          {tab === 'reset' && '想起密码了？'}
          <button
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
            className="text-gold-400 hover:text-gold-300 ml-1 transition-colors"
          >
            {tab === 'login' ? '立即注册' : '去登录'}
          </button>
          {tab === 'login' && (
            <>
              <span className="mx-2 text-ink-700">|</span>
              <button
                onClick={() => switchTab('reset')}
                className="text-gold-400 hover:text-gold-300 transition-colors"
              >
                忘记密码
              </button>
            </>
          )}
        </p>
          </>
        )}
      </div>
    </div>
  );
}
