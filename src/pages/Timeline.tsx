import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import TimelineCalendar from '@/components/TimelineCalendar';
import {
  Upload,
  CheckSquare,
  CheckCircle2,
  StickyNote,
  Edit3,
  MessageCircle,
  Sparkles,
  Clock,
  CalendarDays,
} from 'lucide-react';

type TimelineTab = 'timeline' | 'calendar';

const eventIcons: Record<string, typeof Upload> = {
  file_upload: Upload,
  todo_created: CheckSquare,
  todo_completed: CheckCircle2,
  note_created: StickyNote,
  note_edited: Edit3,
  chat: MessageCircle,
  ai_reminder: Sparkles,
};

const eventColors: Record<string, string> = {
  file_upload: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  todo_created: 'text-gold-400 bg-gold-400/10 border-gold-400/30',
  todo_completed: 'text-forest-400 bg-forest-400/10 border-forest-400/30',
  note_created: 'text-parchment-300 bg-parchment-300/10 border-parchment-300/30',
  note_edited: 'text-parchment-400 bg-parchment-400/10 border-parchment-400/30',
  chat: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  ai_reminder: 'text-gold-300 bg-gold-300/10 border-gold-300/30',
};

const dotColors: Record<string, string> = {
  file_upload: 'bg-blue-400',
  todo_created: 'bg-gold-400',
  todo_completed: 'bg-forest-400',
  note_created: 'bg-parchment-300',
  note_edited: 'bg-parchment-400',
  chat: 'bg-cyan-400',
  ai_reminder: 'bg-gold-300',
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function formatFullTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Timeline() {
  const { timeline } = useAppStore();
  const [activeTab, setActiveTab] = useState<TimelineTab>('timeline');

  // Group by date
  const grouped = timeline.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString('zh-CN');
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, typeof timeline>);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-parchment-100">时间轴</h1>
        <p className="text-sm text-parchment-400 mt-1">记录每日工作与成长</p>
        <div className="mt-4 flex gap-0 border-b border-ink-800/50">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all ${
              activeTab === 'timeline'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-parchment-400 hover:text-parchment-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            时间轴
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all ${
              activeTab === 'calendar'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-parchment-400 hover:text-parchment-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            日历
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <TimelineCalendar />
      ) : (
      <>
      {/* Timeline */}
      <div className="relative max-w-3xl">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-gold-400/30 via-ink-700/50 to-transparent" />

        {Object.entries(grouped).map(([date, events]) => (
          <div key={date} className="mb-8">
            {/* Date header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-ink-900 border border-ink-700/50 flex items-center justify-center z-10 relative">
                <Clock className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-parchment-100">{date}</p>
                <p className="text-xs text-parchment-400">{events.length} 个事件</p>
              </div>
            </div>

            {/* Events */}
            <div className="ml-6 pl-9 space-y-4 border-l border-ink-800/30">
              {events.map((event, index) => {
                const Icon = eventIcons[event.type] || Clock;
                return (
                  <div
                    key={event.id}
                    className="relative animate-slide-in-up"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {/* Dot on timeline */}
                    <div className={`absolute -left-[41px] top-4 w-3 h-3 rounded-full ${dotColors[event.type]} ring-2 ring-ink-950`} />

                    {/* Card */}
                    <div className="glass-card-hover p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border ${eventColors[event.type]} flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-parchment-100">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-parchment-400 mt-1">{event.description}</p>
                          )}
                          <p className="text-[10px] text-ink-500 mt-2">
                            {formatFullTime(event.timestamp)}
                          </p>
                        </div>
                        <span className="text-[10px] text-ink-500 flex-shrink-0">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {timeline.length === 0 && (
        <div className="text-center py-16">
          <Clock className="w-16 h-16 text-ink-700 mx-auto mb-4" />
          <p className="text-parchment-400">暂无活动记录</p>
          <p className="text-xs text-ink-500 mt-1">开始使用 Old Z，你的活动会自动记录在这里</p>
        </div>
      )}
      </>
      )}
    </div>
  );
}
