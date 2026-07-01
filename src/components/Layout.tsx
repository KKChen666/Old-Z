import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import {
  ArrowLeft,
  LayoutDashboard,
  Files,
  CheckSquare,
  StickyNote,
  Network,
  MessageCircle,
  Clock,
  CircleEllipsis,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  User,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/files', icon: Files, label: '文件中心' },
  { to: '/todos', icon: CheckSquare, label: '待办管理' },
  { to: '/notes', icon: StickyNote, label: '笔记' },
  { to: '/graph', icon: Network, label: '知识图谱' },
  { to: '/chat', icon: MessageCircle, label: 'AI 助手' },
  { to: '/timeline', icon: Clock, label: '时间轴' },
  { to: '/settings', icon: Settings, label: '设置' },
];

/** 手机端底部导航栏 */
const mobileNavItems = [
  { to: '/', icon: LayoutDashboard, label: '首页' },
  { to: '/todos', icon: CheckSquare, label: '待办' },
  { to: '/chat', icon: MessageCircle, label: 'AI' },
  { to: '/notes', icon: StickyNote, label: '笔记' },
  { to: '/discover', icon: CircleEllipsis, label: '更多' },
];

const discoverRoutes: Record<string, string> = {
  '/files': '文件中心',
  '/graph': '知识图谱',
  '/timeline': '时间轴',
  '/settings': '设置',
};

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar, user, logout } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const mobileBackTitle = discoverRoutes[location.pathname];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - 仅桌面端显示 */}
      <aside
        className={`hidden md:flex ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } flex-col bg-ink-950 border-r border-ink-800/50 transition-all duration-300 flex-shrink-0`}
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
      <main className="flex-1 overflow-y-auto bg-ink-950 md:pb-0" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {mobileBackTitle && (
          <div className="sticky top-0 z-40 flex h-12 items-center border-b border-ink-800/50 bg-ink-950/95 px-2 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-parchment-200 active:bg-ink-800/80"
              aria-label="返回更多"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="pointer-events-none absolute left-14 right-14 truncate text-center text-base font-medium text-parchment-100">
              {mobileBackTitle}
            </h1>
          </div>
        )}
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-ink-950/95 backdrop-blur-lg border-t border-ink-800/50 safe-area-pb">
        <div className="flex items-center h-14">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `bottom-tab-item flex-1 min-w-0 ${isActive ? 'active text-gold-400' : 'text-parchment-500 active:text-parchment-300'}`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
