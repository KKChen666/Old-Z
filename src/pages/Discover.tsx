import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronRight,
  Clock,
  Files,
  Network,
  Settings,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

type DiscoverItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
  accent: string;
  count?: number;
};

export default function Discover() {
  const { files, timeline, loadData } = useAppStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toolItems: DiscoverItem[] = [
    {
      to: '/files',
      icon: Files,
      label: '文件中心',
      description: '查看上传资料和预览文件',
      accent: 'text-forest-300 bg-forest-800/30',
      count: files.length,
    },
    {
      to: '/graph',
      icon: Network,
      label: '知识图谱',
      description: '浏览笔记、文件和任务的关联',
      accent: 'text-gold-300 bg-gold-400/15',
    },
    {
      to: '/timeline',
      icon: Clock,
      label: '时间轴',
      description: '回顾最近的内容变化',
      accent: 'text-sky-300 bg-sky-500/15',
      count: timeline.length,
    },
  ];

  const preferenceItems: DiscoverItem[] = [
    {
      to: '/settings',
      icon: Settings,
      label: '设置',
      description: '账号、密码和 AI 接口配置',
      accent: 'text-parchment-200 bg-ink-800/80',
    },
  ];

  return (
    <div className="min-h-full bg-ink-950">
      <div className="sticky top-0 z-10 bg-ink-950/95 px-4 pt-4 pb-3 backdrop-blur md:hidden">
        <h1 className="text-xl font-serif font-bold text-parchment-100 text-center">更多</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5">
        <div className="hidden md:block">
          <h1 className="font-serif text-2xl font-bold text-parchment-100">更多</h1>
          <p className="mt-1 text-sm text-parchment-400">集中放置低频工具，保持移动端底栏清爽。</p>
        </div>

        <DiscoverSection items={toolItems} />
        <DiscoverSection items={preferenceItems} />
      </div>
    </div>
  );
}

function DiscoverSection({ items }: { items: DiscoverItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-800/60 bg-ink-900/80">
      {items.map((item, index) => (
        <DiscoverRow key={item.to} item={item} separated={index > 0} />
      ))}
    </div>
  );
}

function DiscoverRow({ item, separated }: { item: DiscoverItem; separated?: boolean }) {
  return (
    <Link
      to={item.to}
      className={`flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors active:bg-ink-800/80 hover:bg-ink-800/50 ${
        separated ? 'border-t border-ink-800/60' : ''
      }`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${item.accent}`}>
        <item.icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-medium text-parchment-100">{item.label}</p>
          {typeof item.count === 'number' && (
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] leading-none text-parchment-400">
              {item.count}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-parchment-500">{item.description}</p>
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-ink-500" />
    </Link>
  );
}
