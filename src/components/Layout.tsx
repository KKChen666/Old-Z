import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import {
  LayoutDashboard,
  Files,
  CheckSquare,
  StickyNote,
  Network,
  MessageCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  User,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/files', icon: Files, label: '文件中心' },
  { to: '/todos', icon: CheckSquare, label: '待办管理' },
  { to: '/notes', icon: StickyNote, label: '笔记' },
  { to: '/graph', icon: Network, label: '知识图谱' },
  { to: '/chat', icon: MessageCircle, label: 'AI 聊天' },
  { to: '/timeline', icon: Clock, label: '时间轴' },
];

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar, user, logout } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } flex flex-col bg-ink-950 border-r border-ink-800/50 transition-all duration-300 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-ink-800/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-ink-950" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-serif font-bold text-lg text-parchment-100 tracking-wide">
              Old Z
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-forest-800/40 text-gold-400 border-l-2 border-gold-400'
                    : 'text-parchment-400 hover:bg-ink-800/60 hover:text-parchment-200'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info & logout */}
        {user && (
          <div className="px-2 py-2 border-t border-ink-800/50">
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-ink-950" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-parchment-100 truncate">
                    {user.displayName || user.username}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-lg text-parchment-400 hover:bg-red-500/10 hover:text-red-400 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
              title="退出登录"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm">退出登录</span>
              )}
            </button>
          </div>
        )}

        {/* Collapse button */}
        <div className="p-2 border-t border-ink-800/50">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded-lg text-parchment-400 hover:bg-ink-800/60 hover:text-parchment-200 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-ink-950">
        <div className="h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
