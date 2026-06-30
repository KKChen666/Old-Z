import React from 'react';
import type { QLProgressData } from '@/types';

interface CalendarHeatmapProps {
  progressData: QLProgressData;
  year?: number;
  month?: number; // 1-12
}

export default function CalendarHeatmap({ progressData, year, month }: CalendarHeatmapProps) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;

  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0=Sun

  const dailyLog = progressData.daily_log || {};

  const getExpForDay = (day: number): number => {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dailyLog[dateStr]?.total_exp || 0;
  };

  const maxExp = Math.max(1, ...Array.from({ length: daysInMonth }, (_, i) => getExpForDay(i + 1)));

  const getColor = (exp: number): string => {
    if (exp === 0) return 'bg-ink-800';
    const ratio = exp / maxExp;
    if (ratio < 0.2) return 'bg-forest-900/50';
    if (ratio < 0.4) return 'bg-forest-800';
    if (ratio < 0.6) return 'bg-forest-700';
    if (ratio < 0.8) return 'bg-forest-600';
    return 'bg-gold-500';
  };

  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

  // 填充空白格
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="glass-card p-4">
      <h4 className="text-sm text-parchment-400 mb-3">{y}年{m}月</h4>
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-[10px] text-parchment-500 py-0.5">
            {name}
          </div>
        ))}
        {cells.map((day, idx) => (
          <div
            key={idx}
            className={`aspect-square rounded-sm flex items-center justify-center text-[10px] ${
              day !== null ? getColor(getExpForDay(day)) + ' text-parchment-200 cursor-default' : 'bg-transparent'
            }`}
            title={day !== null ? `${y}-${m}-${day}: ${getExpForDay(day)} EXP` : ''}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-parchment-500">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-ink-800" />
        <div className="w-3 h-3 rounded-sm bg-forest-900/50" />
        <div className="w-3 h-3 rounded-sm bg-forest-700" />
        <div className="w-3 h-3 rounded-sm bg-forest-600" />
        <div className="w-3 h-3 rounded-sm bg-gold-500" />
        <span>多</span>
      </div>
    </div>
  );
}
