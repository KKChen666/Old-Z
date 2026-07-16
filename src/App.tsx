import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import { useAppStore } from "@/stores/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { api, getToken, clearAuth, syncTokenToNative, clearNativeToken } from "@/utils/api";
import { useTheme } from "@/hooks/useTheme";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isLocalModeActive, supportsLocalMode } from "@/utils/runtime";

// 路由级 code splitting — 每个页面独立 chunk，首屏只加载当前路由
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Files = lazy(() => import("@/pages/Files"));
const Todos = lazy(() => import("@/pages/Todos"));
const Notes = lazy(() => import("@/pages/Notes"));
const Chat = lazy(() => import("@/pages/Chat"));
const Timeline = lazy(() => import("@/pages/Timeline"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const Discover = lazy(() => import("@/pages/Discover"));
const SyncStatus = lazy(() => import("@/pages/SyncStatus"));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center bg-ink-950">
      <div className="text-parchment-400 text-sm animate-pulse">加载中…</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAppStore(useShallow((s) => ({ user: s.user, setUser: s.setUser })));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // 本地模式和正常模式都尝试恢复 token
    api.getMe()
      .then(u => { setUser(u); })
      .catch(() => {
        clearAuth();
        // 本地模式下 token 失效，清除标记让用户重新点击"本地使用"
        if (localStorage.getItem('old-z-local-mode') === 'true') {
          localStorage.removeItem('old-z-local-mode');
        }
      })
      .finally(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-950">
        <div className="text-parchment-100 text-lg">加载中...</div>
      </div>
    );
  }

  // 未登录 → 去登录页
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  useTheme();
  const { user, setUser } = useAppStore(useShallow((s) => ({ user: s.user, setUser: s.setUser })));
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!supportsLocalMode() && localStorage.getItem('old-z-local-mode') === 'true') {
      localStorage.removeItem('old-z-local-mode');
      clearAuth();
      clearNativeToken();
      setUser(null);
      setAuthChecked(true);
      return;
    }

    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    // 应用启动时同步 Token 到原生层（供桌面小部件使用）
    syncTokenToNative(token);
    // 认证检查交给 ProtectedRoute 负责，App 不再重复调用 getMe
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const handler = () => {
      clearAuth();
      clearNativeToken();
      setUser(null);
    };
    window.addEventListener('auth-expired', handler);
    return () => window.removeEventListener('auth-expired', handler);
  }, []);

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-950">
        <div className="text-parchment-100 text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={(user && !isLocalModeActive()) ? <Navigate to="/" replace /> : <Login />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/files" element={<Files />} />
                <Route path="/todos" element={<Todos />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/sync" element={<SyncStatus />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
    </ToastProvider>
  );
}
