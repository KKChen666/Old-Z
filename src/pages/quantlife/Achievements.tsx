import React from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys } from '@/stores/useQuantLifeStore';
import { Trophy, Star, Flame, Zap, Target, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ 成就系统配置 ============
const RANK_BANDS = [
  { min: 1, max: 10, title: '摸鱼萌新', color: '#9a8a5a', emoji: '🐣' },
  { min: 11, max: 30, title: '稳步打工仔', color: '#5ac8fa', emoji: '💼' },
  { min: 31, max: 60, title: '稳定成长者', color: '#34c759', emoji: '🌱' },
  { min: 61, max: 100, title: '平衡大师', color: '#af52de', emoji: '⚖️' },
  { min: 101, max: 200, title: '多线并行选手', color: '#ff9500', emoji: '🔱' },
  { min: 201, max: 500, title: '全能卷王', color: '#ff3b30', emoji: '👑' },
  { min: 501, max: 10000, title: '究极八边形战神', color: '#d4a853', emoji: '💎' },
];

const GROWTH_BADGES = [50, 100, 150, 200, 300, 500, 700, 900, 1000];

const DIMENSION_MASTERY_NAMES: Record<number, string> = {
  1: '入门学徒',
  2: '进阶达人',
  3: '精通专家',
  4: '大师传奇',
};

export default function Achievements() {
  const { progressData } = useQuantLifeStore();
  if (!progressData) return null;

  const level = progressData.level;
  const totalExp = progressData.total_exp;
  const defs = progressData.meta?.dimensions?.defs || {};
  const enabledKeys = getEnabledDimensionKeys(progressData);

  // 当前段位
  const rank = RANK_BANDS.find(r => level >= r.min && level <= r.max) || RANK_BANDS[RANK_BANDS.length - 1];

  // 成长徽章
  const earnedGrowthBadges = GROWTH_BADGES.filter(b => level >= b);

  // 维度精通
  const dimensionMasteries = enabledKeys.map(key => {
    const dim = progressData.dimensions[key];
    const dimLevel = dim ? Math.floor(dim.total_exp / 200) + 1 : 1;
    const step = dimLevel >= 80 ? 4 : dimLevel >= 50 ? 3 : dimLevel >= 25 ? 2 : dimLevel >= 10 ? 1 : 0;
    return { key, def: defs[key], level: dimLevel, step };
  });

  // 连续打卡 (简单计算)
  const historyDates = new Set(progressData.history.map(e => e.date));
  const sortedDates = Array.from(historyDates).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (historyDates.has(ds)) streak++;
    else break;
  }

  const streakBadges = [
    { days: 7, label: '7天连续', emoji: '🔥' },
    { days: 30, label: '月度全勤', emoji: '📅' },
    { days: 90, label: '季度战神', emoji: '⚡' },
    { days: 180, label: '半年不懈', emoji: '💪' },
    { days: 365, label: '年度传说', emoji: '👑' },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-gold-400" />
        <h2 className="text-lg font-serif font-bold text-parchment-100">成就勋章</h2>
      </div>

      {/* 当前段位 */}
      <div className="glass-card p-6 text-center">
        <div className="text-5xl mb-3">{rank.emoji}</div>
        <div className="text-xl font-bold" style={{ color: rank.color }}>{rank.title}</div>
        <div className="text-sm text-parchment-400 mt-1">Lv.{level} · {totalExp.toLocaleString()} EXP</div>
        <div className="text-xs text-parchment-500 mt-3">
          下一段位：{RANK_BANDS[RANK_BANDS.indexOf(rank) + 1]?.title || '已达到最高段位'}
        </div>
      </div>

      {/* 成长徽章 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-parchment-100 mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-gold-400" />
          成长徽章 ({earnedGrowthBadges.length}/{GROWTH_BADGES.length})
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {GROWTH_BADGES.map((threshold) => {
            const earned = level >= threshold;
            return (
              <div
                key={threshold}
                className={cn(
                  'text-center p-3 rounded-lg transition-all',
                  earned ? 'bg-gold-400/10 border border-gold-400/30' : 'bg-ink-800/40 opacity-40'
                )}
              >
                <div className="text-2xl mb-1">{earned ? '🏅' : '🔒'}</div>
                <div className={cn('text-xs', earned ? 'text-gold-400' : 'text-parchment-600')}>
                  Lv.{threshold}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 维度精通 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-parchment-100 mb-4 flex items-center gap-2">
          <Star className="w-4 h-4 text-gold-400" />
          维度精通
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dimensionMasteries.map(({ key, def, level: dimLevel, step }) => (
            <div key={key} className="glass-card p-3 text-center">
              <div className="text-2xl mb-1">{def?.emoji || '📊'}</div>
              <div className="text-xs text-parchment-300">{def?.name || key}</div>
              <div className="text-xs font-mono mt-1" style={{ color: def?.color }}>
                Lv.{dimLevel}
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      step >= s ? 'bg-gold-400' : 'bg-ink-700'
                    )}
                    title={DIMENSION_MASTERY_NAMES[s]}
                  />
                ))}
              </div>
              <div className="text-[10px] text-parchment-500 mt-1">
                {step > 0 ? DIMENSION_MASTERY_NAMES[step] : '未入门'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 连续打卡徽章 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-parchment-100 mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-gold-400" />
          连续打卡 · 当前 {streak} 天
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {streakBadges.map(({ days, label, emoji }) => {
            const earned = streak >= days;
            return (
              <div
                key={days}
                className={cn(
                  'text-center p-3 rounded-lg',
                  earned ? 'bg-gold-400/10 border border-gold-400/30' : 'bg-ink-800/40 opacity-40'
                )}
              >
                <div className="text-xl">{earned ? emoji : '🔒'}</div>
                <div className={cn('text-[10px] mt-1', earned ? 'text-gold-400' : 'text-parchment-600')}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 里程碑徽章 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-parchment-100 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-gold-400" />
          里程碑 · 任意维度达到 Lv.80
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {dimensionMasteries.map(({ key, def, level: dimLevel }) => {
            const reached = dimLevel >= 80;
            return (
              <div
                key={key}
                className={cn(
                  'text-center p-3 rounded-lg',
                  reached ? 'bg-gold-400/10 border border-gold-400/30' : 'bg-ink-800/40 opacity-40'
                )}
              >
                <div className="text-xl">{reached ? '🎖️' : '🔒'}</div>
                <div className={cn('text-[10px] mt-1', reached ? 'text-gold-400' : 'text-parchment-600')}>
                  {def?.name || key}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
