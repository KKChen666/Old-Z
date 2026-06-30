import React from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys, formatYMDLocal } from '@/stores/useQuantLifeStore';
import RadarChart from './components/RadarChart';
import ExpBar from './components/ExpBar';
import LevelBadge from './components/LevelBadge';
import DimensionCard from './components/DimensionCard';
import QuickCheckin from './components/QuickCheckin';
import AiIngest from './components/AiIngest';
import CalendarHeatmap from './components/CalendarHeatmap';
import { TrendingUp, Target, Zap, CalendarDays } from 'lucide-react';

export default function Overview() {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();

  if (!progressData) return null;

  const enabledKeys = getEnabledDimensionKeys(progressData);
  const defs = progressData.meta?.dimensions?.defs || {};
  const profile = progressData.meta?.profile || { nickname: '成长玩家', tagline: '', avatar_text: 'Q' };

  // 统计数据
  const today = formatYMDLocal(new Date());
  const todayLog = progressData.daily_log[today];
  const todayExp = todayLog?.total_exp || 0;

  const handleAiIngested = (result: any) => {
    if (result.progress) {
      updateProgress(() => {
        Object.assign(progressData, result.progress);
      });
      saveProgress(result.progress);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <LevelBadge level={progressData.level} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-serif font-bold text-parchment-100">
            {profile.nickname || '成长玩家'}
          </h1>
          <p className="text-xs text-parchment-400 mt-0.5">
            {profile.tagline || '把生活变成一场持续升级的游戏。'}
          </p>
          <div className="mt-2 max-w-md">
            <ExpBar
              current={progressData.current_level_exp}
              max={progressData.exp_to_next}
              level={progressData.level}
            />
          </div>
        </div>
      </div>

      {/* 成长统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-bold text-gold-400">{progressData.total_exp.toLocaleString()}</div>
          <div className="text-xs text-parchment-400 mt-1">总经验</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-bold text-forest-400">{todayExp}</div>
          <div className="text-xs text-parchment-400 mt-1">今日 EXP</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">Lv.{progressData.level}</div>
          <div className="text-xs text-parchment-400 mt-1">当前等级</div>
        </div>
      </div>

      {/* 雷达图 + 维度卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-4 flex items-center justify-center">
          <RadarChart progressData={progressData} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-400" />
            维度总览
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {enabledKeys.map((key) => {
              const def = defs[key];
              if (!def || def.archived) return null;
              return (
                <DimensionCard
                  key={key}
                  dimKey={key}
                  dimDef={def}
                  progressData={progressData}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 快速打卡 + AI 解析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <QuickCheckin />
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            AI 智能解析
          </h3>
          <p className="text-xs text-parchment-400">
            用自然语言描述今天的活动，AI 自动解析并计算经验值
          </p>
          <AiIngest date={today} onIngested={handleAiIngested} />
        </div>
      </div>

      {/* 日历热力图 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <CalendarHeatmap progressData={progressData} />
        {/* 最近记录 */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-gold-400" />
            最近活动
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {progressData.history.slice(-10).reverse().map((entry, i) => {
              const def = defs[entry.dimension_key];
              return (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-ink-800/30 last:border-0">
                  <span className="text-lg">{def?.emoji || '📊'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-parchment-200 truncate">{entry.description}</div>
                    <div className="text-xs text-parchment-500">{entry.date} · {entry.task_type}</div>
                  </div>
                  <span className="text-xs font-bold text-gold-400 whitespace-nowrap">
                    +{entry.exp_gained}
                  </span>
                </div>
              );
            })}
            {progressData.history.length === 0 && (
              <div className="text-sm text-parchment-500 text-center py-4">暂无记录，快去打卡吧！</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
