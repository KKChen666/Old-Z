import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/utils/api';
import TimelineCalendar from '@/components/TimelineCalendar';
import {
  Upload, CheckSquare, CheckCircle2, StickyNote, Edit3,
  MessageCircle, Sparkles, Clock, CalendarDays, GitCommit, Plus, Minus, X, Loader2, RefreshCw,
} from 'lucide-react';

type TimelineTab = 'timeline' | 'calendar' | 'gitlog';

const eventIcons: Record<string, typeof Upload> = {
  file_upload: Upload, todo_created: CheckSquare, todo_completed: CheckCircle2,
  note_created: StickyNote, note_edited: Edit3, chat: MessageCircle, ai_reminder: Sparkles,
};

const eventColors: Record<string, string> = {
  file_upload: 'text-forest-300 bg-forest-400/10 border-forest-400/30',
  todo_created: 'text-gold-400 bg-gold-400/10 border-gold-400/30',
  todo_completed: 'text-forest-400 bg-forest-400/10 border-forest-400/30',
  note_created: 'text-parchment-300 bg-parchment-300/10 border-parchment-300/30',
  note_edited: 'text-parchment-400 bg-parchment-400/10 border-parchment-400/30',
  chat: 'text-forest-300 bg-forest-400/10 border-forest-400/30',
  ai_reminder: 'text-gold-300 bg-gold-300/10 border-gold-300/30',
};

const dotColors: Record<string, string> = {
  file_upload: 'bg-forest-400', todo_created: 'bg-gold-400', todo_completed: 'bg-forest-400',
  note_created: 'bg-parchment-300', note_edited: 'bg-parchment-400',
  chat: 'bg-forest-400', ai_reminder: 'bg-gold-300',
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();
  if (diff < 0) return '刚刚';
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  if (h < 24) return `${h} 小时前`;
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function formatFullTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function shortHash(id: string): string { return id.slice(0, 7); }

// ---- Diff Modal (real git show) ----

function DiffModal({ hash, title, onClose }: { hash: string; title: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [diff, setDiff] = useState<{ message: string; date: string; authorName: string; diff: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.git.diff(hash).then((d: any) => {
      setDiff(d);
    }).catch((e: any) => setError(e.message || '加载失败'))
    .finally(() => setLoading(false));
  }, [hash]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-ink-900 border border-ink-700/50 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800/50">
          <div className="flex items-center gap-2 min-w-0">
            <GitCommit className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-parchment-100 truncate">{title}</span>
          </div>
          <button onClick={onClose} className="p-1 text-ink-500 hover:text-parchment-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-4 max-h-[70vh]">
          {loading && <p className="text-sm text-ink-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 加载差异...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {diff && (
            <div>
              <div className="mb-3 p-3 rounded-lg bg-ink-950/60 border border-ink-800/50 space-y-1">
                <p className="text-xs text-parchment-300 font-medium">{diff.message}</p>
                <p className="text-[10px] text-ink-500">
                  {diff.authorName} · {new Date(diff.date).toLocaleString()}
                </p>
              </div>
              <pre className="text-xs font-mono text-parchment-300 whitespace-pre-wrap break-all bg-ink-950/80 rounded-lg p-3 border border-ink-800/50 max-h-[50vh] overflow-y-auto">
                {diff.diff.split('\n').map((line, i) => {
                  let colorClass = 'text-parchment-400';
                  if (line.startsWith('+') && !line.startsWith('+++')) colorClass = 'text-green-400';
                  else if (line.startsWith('-') && !line.startsWith('---')) colorClass = 'text-red-400';
                  else if (line.startsWith('@@')) colorClass = 'text-amber-400';
                  else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) colorClass = 'text-ink-500';
                  else if (line.startsWith('commit ') || line.startsWith('Author:') || line.startsWith('Date:')) colorClass = 'text-amber-300';
                  return <div key={i} className={colorClass}>{line}</div>;
                })}
              </pre>
            </div>
          )}
          {!loading && !error && !diff && (
            <p className="text-sm text-ink-500">暂无差异数据</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Git Log Tab ----

function GitLog() {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<{ branch: string; initialized: boolean }>({ branch: 'main', initialized: false });
  const [diffCommit, setDiffCommit] = useState<{ hash: string; title: string } | null>(null);

  const loadLog = async () => {
    setLoading(true);
    setError('');
    try {
      const [gitInfo, logData] = await Promise.all([
        api.git.info().catch(() => ({ initialized: false, branch: 'main' })),
        api.git.log({ limit: 100 }).catch(() => []),
      ]);
      setInfo({ branch: (gitInfo as any).branch || 'main', initialized: (gitInfo as any).initialized });
      setCommits(Array.isArray(logData) ? logData : []);
    } catch (e: any) {
      setError(e.message || '无法获取 Git 历史');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLog(); }, []);

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 0) return '刚刚';
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m} 分钟前`;
    if (h < 24) return `${h} 小时前`;
    if (d < 30) return `${d} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  };

  return (
    <div className="relative max-w-3xl font-mono">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] text-ink-500 space-y-0.5">
          <p>commit history for branch <span className="text-amber-400">{info.branch || 'main'}</span></p>
          {commits.length > 0 && <p className="text-ink-600">{commits.length} commits</p>}
        </div>
        <button onClick={loadLog} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-ink-500 hover:text-parchment-300 hover:bg-ink-800/50 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
      </div>

      {loading && commits.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-ink-500 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 加载提交历史...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 mb-3">{error}</div>
      )}

      {!loading && !error && commits.length === 0 && (
        <div className="text-ink-500 text-sm space-y-1">
          <p>fatal: your current branch '{info.branch || 'main'}' does not have any commits yet</p>
          <p className="text-ink-600">(use "新建笔记" to create the first commit)</p>
          {!info.initialized && (
            <p className="text-ink-600">(git repository not initialized — it will be created automatically on first change)</p>
          )}
        </div>
      )}

      {commits.map((c: any) => (
        <div key={c.hash} className="group flex items-start gap-3 px-3 py-2 rounded hover:bg-ink-900/40 transition-colors cursor-default">
          <span className="text-[11px] text-amber-400/70 flex-shrink-0 pt-0.5 select-all font-mono">{c.shortHash}</span>
          {c.refs && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400 flex-shrink-0 font-sans">{c.refs.split(',').map((r: string) => r.trim()).filter((r: string) => r.includes('HEAD')).join(' ')}</span>
          )}
          <span className="text-sm text-parchment-200 flex-1 truncate font-sans">{c.message.split('\n')[0]}</span>
          <span className="text-[10px] text-ink-600 flex-shrink-0">
            {formatTime(c.date)}
          </span>
          <button
            onClick={() => setDiffCommit({ hash: c.hash, title: c.message.split('\n')[0] })}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-400 hover:text-amber-300 transition-all flex-shrink-0 font-sans">
            diff
          </button>
        </div>
      ))}

      {diffCommit && (
        <DiffModal hash={diffCommit.hash} title={diffCommit.title} onClose={() => setDiffCommit(null)} />
      )}
    </div>
  );
}

// ---- Main ----

export default function Timeline() {
  const timeline = useAppStore((s) => s.timeline);
  const [activeTab, setActiveTab] = useState<TimelineTab>('timeline');

  const grouped = timeline.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString('zh-CN');
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, typeof timeline>);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-parchment-100">时间轴</h1>
        <p className="text-sm text-parchment-400 mt-1">记录每日工作与成长</p>
        <div className="mt-4 flex gap-0 border-b border-ink-800/50">
          <button onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all ${
              activeTab === 'timeline' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200'}`}>
            <Clock className="w-4 h-4" /> 时间轴
          </button>
          <button onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all ${
              activeTab === 'calendar' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200'}`}>
            <CalendarDays className="w-4 h-4" /> 日历
          </button>
          <button onClick={() => setActiveTab('gitlog')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all ${
              activeTab === 'gitlog' ? 'border-gold-400 text-gold-400' : 'border-transparent text-parchment-400 hover:text-parchment-200'}`}>
            <GitCommit className="w-4 h-4" /> Git Log
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <TimelineCalendar />
      ) : activeTab === 'gitlog' ? (
        <GitLog />
      ) : (
      <div className="relative max-w-3xl">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-gold-400/30 via-ink-700/50 to-transparent" />
        {Object.entries(grouped).map(([date, events]) => (
          <div key={date} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-ink-900 border border-ink-700/50 flex items-center justify-center z-10 relative">
                <Clock className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-parchment-100">{date}</p>
                <p className="text-xs text-parchment-400">{events.length} 个事件</p>
              </div>
            </div>
            <div className="ml-6 pl-9 space-y-4 border-l border-ink-800/30">
              {events.map((event, index) => {
                const Icon = eventIcons[event.type] || Clock;
                return (
                  <div key={event.id} className="relative animate-slide-in-up" style={{ animationDelay: `${index * 80}ms` }}>
                    <div className={`absolute -left-[41px] top-4 w-3 h-3 rounded-full ${dotColors[event.type]} ring-2 ring-ink-950`} />
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
                          <p className="text-[10px] text-ink-500 mt-2">{formatFullTime(event.timestamp)}</p>
                        </div>
                        <span className="text-[10px] text-ink-500 flex-shrink-0">{formatTime(event.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}

      {activeTab === 'timeline' && timeline.length === 0 && (
        <div className="text-center py-16">
          <Clock className="w-16 h-16 text-ink-700 mx-auto mb-4" />
          <p className="text-parchment-400">暂无活动记录</p>
          <p className="text-xs text-ink-500 mt-1">开始使用 Old Z，你的活动会自动记录在这里</p>
        </div>
      )}
    </div>
  );
}
