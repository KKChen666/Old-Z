import React from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys, formatYMDLocal, parseYMDLocal } from '@/stores/useQuantLifeStore';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

export default function TodayStats() {
  const { progressData, selectedDate, setSelectedDate } = useQuantLifeStore();
  if (!progressData) return null;

  const defs = progressData.meta?.dimensions?.defs || {};
  const dailyLog = progressData.daily_log[selectedDate];
  const entries = dailyLog?.entries || [];
  const totalExp = dailyLog?.total_exp || 0;

  // 生成一周的日期选择器
  const anchor = parseYMDLocal(selectedDate);
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - anchor.getDay() + 1); // 周一

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(formatYMDLocal(d));
  }

  const goWeek = (dir: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dir * 7);
    setSelectedDate(formatYMDLocal(d));
  };

  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
  const today = formatYMDLocal(new Date());

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* 日期选择器 */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => goWeek(-1)} className="text-parchment-400 hover:text-parchment-200">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-semibold text-parchment-100">
            {selectedDate}
          </h3>
          <button onClick={() => goWeek(1)} className="text-parchment-400 hover:text-parchment-200">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const log = progressData.daily_log[date];
            const exp = log?.total_exp || 0;
            const isSelected = date === selectedDate;
            const isToday = date === today;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'flex flex-col items-center py-2 rounded-lg transition-all text-xs',
                  isSelected
                    ? 'bg-gold-400/20 text-gold-400 ring-1 ring-gold-400/50'
                    : isToday
                    ? 'bg-forest-800/40 text-forest-300'
                    : 'text-parchment-400 hover:bg-ink-800/60'
                )}
              >
                <span className="text-[10px]">{dayNames[i]}</span>
                <span className="font-mono mt-0.5">{date.slice(-2)}</span>
                <span className={cn('text-[10px] mt-0.5', exp > 0 ? 'text-gold-400' : 'text-parchment-600')}>
                  {exp > 0 ? `+${exp}` : '·'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 今日统计 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-gold-400" />
          {selectedDate === today ? '今日战绩' : selectedDate} · 总计 {totalExp} EXP
        </h3>

        {entries.length === 0 ? (
          <div className="text-center py-8 text-parchment-500">这天还没有记录</div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry: any, i: number) => {
              const def = defs[entry.dimension_key];
              return (
                <div key={i} className="flex items-center gap-3 glass-card p-3">
                  <div
                    className="w-1 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: def?.color || '#888' }}
                  />
                  <span className="text-xl">{def?.emoji || '📊'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-parchment-200">{entry.description}</div>
                    <div className="text-xs text-parchment-500">
                      {entry.task_type} · {entry.difficulty}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gold-400">+{entry.exp_gained}</div>
                    <div className="text-xs text-parchment-500">EXP</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 今日维度汇总 */}
      {entries.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-xs text-parchment-400 mb-3">维度分布</h4>
          <div className="space-y-2">
            {Object.entries(
              entries.reduce((acc: Record<string, number>, e: any) => {
                acc[e.dimension_key] = (acc[e.dimension_key] || 0) + e.exp_gained;
                return acc;
              }, {})
            ).map(([key, exp]) => {
              const def = defs[key];
              const pct = Math.round((exp / totalExp) * 100);
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm w-6">{def?.emoji || '📊'}</span>
                  <span className="text-xs text-parchment-300 w-16 truncate">{def?.name || key}</span>
                  <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: def?.color || '#888' }}
                    />
                  </div>
                  <span className="text-xs text-parchment-400 w-12 text-right">+{exp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
