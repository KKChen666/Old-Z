import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Files from "@/pages/Files";
import Todos from "@/pages/Todos";
import Notes from "@/pages/Notes";
import Graph from "@/pages/Graph";
import Chat from "@/pages/Chat";
import Timeline from "@/pages/Timeline";
import { useAppStore } from "@/stores/useAppStore";
import { api, getToken, clearAuth } from "@/utils/api";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAppStore();
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
    api.getMe()
      .then(u => { setUser(u); })
      .catch(() => { clearAuth(); })
      .finally(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-950">
        <div className="text-parchment-100 text-lg">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, setUser } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api.getMe()
      .then(u => { setUser(u); })
      .catch(() => { clearAuth(); })
      .finally(() => { setAuthChecked(true); });
  }, []);

  useEffect(() => {
    const handler = () => {
      clearAuth();
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
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/files" element={<Files />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/timeline" element={<Timeline />} />
        </Route>
      </Routes>
    </Router>
  );
}
