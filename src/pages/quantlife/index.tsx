import React, { useEffect } from 'react';
import { useQuantLifeStore } from '@/stores/useQuantLifeStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  PiggyBank,
  Flame,
  Lightbulb,
  Trophy,
  Settings,
  TrendingUp,
} from 'lucide-react';
import Overview from './Overview';
import TodayStats from './TodayStats';
import History from './History';
import Wealth from './Wealth';
import TaskCamp from './TaskCamp';
import AIPlan from './AIPlan';
import Achievements from './Achievements';
import SettingsPage from './Settings';

const sections = [
  { key: 'overview', icon: LayoutDashboard, label: '总览' },
  { key: 'today', icon: CalendarDays, label: '今日战绩' },
  { key: 'history', icon: Clock, label: '历史记录' },
  { key: 'wealth', icon: PiggyBank, label: '财富目标' },
  { key: 'taskcamp', icon: Flame, label: '任务营地' },
  { key: 'aiplan', icon: Lightbulb, label: 'AI 规划' },
  { key: 'achievements', icon: Trophy, label: '成就勋章' },
  { key: 'settings', icon: Settings, label: '设置' },
];

export default function QuantLife() {
  const { activeSection, setActiveSection, loadProgress, loadLlmConfig, progressData } = useQuantLifeStore();

  useEffect(() => {
    loadProgress();
    loadLlmConfig();
  }, []);

  const renderSection = () => {
    if (!progressData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-parchment-400">加载中...</div>
        </div>
      );
    }
    switch (activeSection) {
      case 'overview': return <Overview />;
      case 'today': return <TodayStats />;
      case 'history': return <History />;
      case 'wealth': return <Wealth />;
      case 'taskcamp': return <TaskCamp />;
      case 'aiplan': return <AIPlan />;
      case 'achievements': return <Achievements />;
      case 'settings': return <SettingsPage />;
      default: return <Overview />;
    }
  };

  return (
    <div className="flex h-full">
      {/* 二级侧边栏 - 桌面端 */}
      <aside className="hidden lg:flex w-48 flex-col bg-ink-950/80 border-r border-ink-800/50 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 h-12 border-b border-ink-800/50">
          <TrendingUp className="w-4 h-4 text-gold-400" />
          <span className="text-sm font-semibold text-parchment-100">成长系统</span>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-200',
                activeSection === section.key
                  ? 'bg-forest-800/40 text-gold-400 border-l-2 border-gold-400'
                  : 'text-parchment-400 hover:bg-ink-800/60 hover:text-parchment-200'
              )}
            >
              <section.icon className="w-4 h-4 flex-shrink-0" />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 移动端顶部 Tab 栏 */}
      <div className="lg:hidden w-full">
        <div className="flex overflow-x-auto border-b border-ink-800/50 bg-ink-950/90 sticky top-0 z-10 scrollbar-none">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={cn(
                'flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all border-b-2',
                activeSection === section.key
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-parchment-400'
              )}
            >
              <section.icon className="w-3.5 h-3.5 inline mr-1" />
              {section.label}
            </button>
          ))}
        </div>
        <div className="p-3">
          {renderSection()}
        </div>
      </div>

      {/* 桌面端内容区 */}
      <div className="hidden lg:block flex-1 overflow-y-auto p-5">
        {renderSection()}
      </div>
    </div>
  );
}
