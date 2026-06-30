import React, { useState } from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys, calcExp, DIFFICULTY_MULT, QUALITY_MULT, recomputeLevels } from '@/stores/useQuantLifeStore';
import type { QLTask, QLTaskTier, QLDailyLogEntry } from '@/types';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Trash2, Flame } from 'lucide-react';

const TIERS: { key: QLTaskTier; label: string; icon: string }[] = [
  { key: 'daily', label: '每日', icon: '☀️' },
  { key: 'monthly', label: '月度', icon: '🌙' },
  { key: 'yearly', label: '年度', icon: '⭐' },
];

export default function TaskCamp() {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();
  const [activeTier, setActiveTier] = useState<QLTaskTier>('daily');
  const [showAdd, setShowAdd] = useState(false);

  // 新建任务表单
  const [newTitle, setNewTitle] = useState('');
  const [newDimKey, setNewDimKey] = useState('research');
  const [newMinutes, setNewMinutes] = useState(30);
  const [newQuality, setNewQuality] = useState<'low' | 'normal' | 'high'>('normal');

  if (!progressData) return null;

  const defs = progressData.meta?.dimensions?.defs || {};
  const enabledKeys = getEnabledDimensionKeys(progressData);
  const taskCamp = progressData.task_camp;

  const getTierData = (tier: QLTaskTier) => {
    if (tier === 'daily') return taskCamp.daily;
    if (tier === 'monthly') return taskCamp.monthly;
    return taskCamp.yearly;
  };

  const tierData = getTierData(activeTier);
  const tasks = tierData.tasks || [];

  const handleToggle = (task: QLTask) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    updateProgress((draft) => {
      const draftTier = activeTier === 'daily' ? draft.task_camp.daily :
        activeTier === 'monthly' ? draft.task_camp.monthly : draft.task_camp.yearly;

      const t = draftTier.tasks.find((t: QLTask) => t.id === task.id);
      if (!t) return;

      if (activeTier === 'daily') {
        // 每日任务：简单 toggle
        t.done = !t.done;
      } else {
        // 月度/年度：状态循环
        const statusCycle: Array<QLTask['status']> = ['not_started', 'in_progress', 'done'];
        const cur = t.status || 'not_started';
        const next = statusCycle[(statusCycle.indexOf(cur) + 1) % 3];
        t.status = next;
        t.done = next === 'done';
      }

      // 发放或撤回 EXP
      if (t.done) {
        const def = defs[task.dimension_key];
        const baseRate = def?.exp_config?.base_rate_per_hour || 50;
        const coeff = def?.exp_config?.coefficient || 1.0;
        const qualityMult = QUALITY_MULT[task.quality] || 1.0;
        const exp = calcExp(task.minutes, baseRate, DIFFICULTY_MULT.normal, qualityMult);

        t.reward_exp = exp;

        const entry = {
          date: dateStr,
          dimension_key: task.dimension_key,
          task_type: def?.name || task.dimension_key,
          difficulty: `任务营地·${task.quality}·${task.minutes}min`,
          description: `✅ ${task.title}`,
          exp_gained: exp,
          completed: true,
        };

        draft.history.push(entry);
        if (!draft.dimensions[task.dimension_key]) {
          draft.dimensions[task.dimension_key] = { total_exp: 0 };
        }
        draft.dimensions[task.dimension_key].total_exp += exp;
        draft.total_exp += exp;

        if (!draft.daily_log[dateStr]) {
          draft.daily_log[dateStr] = { date: dateStr, entries: [], total_exp: 0, all_done: false, insights: [] };
        }
        draft.daily_log[dateStr].entries.push(entry);
        draft.daily_log[dateStr].total_exp += exp;
      } else if (t.reward_exp && t.reward_exp > 0) {
        // 撤回 EXP
        const exp = t.reward_exp;
        draft.total_exp = Math.max(0, draft.total_exp - exp);
        if (draft.dimensions[task.dimension_key]) {
          draft.dimensions[task.dimension_key].total_exp = Math.max(0, draft.dimensions[task.dimension_key].total_exp - exp);
        }
        if (draft.daily_log[dateStr]) {
          draft.daily_log[dateStr].total_exp = Math.max(0, draft.daily_log[dateStr].total_exp - exp);
        }
        t.reward_exp = 0;
      }

      recomputeLevels(draft);
      draft.meta.last_synced_at = new Date().toISOString();
    });

    saveProgress();
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;

    updateProgress((draft) => {
      const draftTier = activeTier === 'daily' ? draft.task_camp.daily :
        activeTier === 'monthly' ? draft.task_camp.monthly : draft.task_camp.yearly;

      const id = `${activeTier[0]}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      draftTier.tasks.push({
        id,
        title: newTitle.trim(),
        dimension_key: newDimKey,
        minutes: newMinutes,
        quality: newQuality,
        done: false,
        reward_entry_id: null,
        reward_exp: 0,
        status: 'not_started' as const,
      });
    });

    setShowAdd(false);
    setNewTitle('');
    saveProgress();
  };

  const handleDelete = (taskId: string) => {
    updateProgress((draft) => {
      const draftTier = activeTier === 'daily' ? draft.task_camp.daily :
        activeTier === 'monthly' ? draft.task_camp.monthly : draft.task_camp.yearly;
      draftTier.tasks = draftTier.tasks.filter((t: QLTask) => t.id !== taskId);
    });
    saveProgress();
  };

  const doneCount = tasks.filter((t: QLTask) => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* 标签切换 */}
      <div className="flex gap-2">
        {TIERS.map((tier) => (
          <button
            key={tier.key}
            onClick={() => setActiveTier(tier.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTier === tier.key
                ? 'bg-gold-400/20 text-gold-400 border border-gold-400/50'
                : 'bg-ink-800/50 text-parchment-400 hover:text-parchment-200'
            )}
          >
            {tier.icon} {tier.label}
          </button>
        ))}
      </div>

      {/* 进度概览 */}
      <div className="glass-card p-4 flex items-center gap-4">
        <Flame className={cn('w-6 h-6', allDone ? 'text-gold-400' : 'text-parchment-600')} />
        <div>
          <div className="text-sm text-parchment-200">
            {tierData.title} · {doneCount}/{tasks.length} 完成
            {allDone && <span className="text-gold-400 ml-2">🔥 全勤！</span>}
          </div>
          {activeTier === 'daily' && (
            <div className="text-xs text-parchment-400 mt-0.5">
              全部完成后可额外获得 {taskCamp.daily.reward_exp} EXP 奖励
            </div>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-2">
        {tasks.map((task: QLTask) => {
          const def = defs[task.dimension_key];
          const statusLabel = !task.done && task.status
            ? { not_started: '未开始', in_progress: '进行中', done: '已完成' }[task.status]
            : '';
          return (
            <div
              key={task.id}
              className={cn(
                'glass-card p-3 flex items-center gap-3 transition-all',
                task.done && 'opacity-60'
              )}
            >
              <button
                onClick={() => handleToggle(task)}
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  task.done
                    ? 'bg-forest-500 border-forest-500'
                    : 'border-ink-600 hover:border-gold-400'
                )}
              >
                {task.done && <Check className="w-3 h-3 text-ink-950" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className={cn('text-sm', task.done ? 'text-parchment-500 line-through' : 'text-parchment-200')}>
                  {task.title}
                </div>
                <div className="text-xs text-parchment-500 flex items-center gap-2 mt-0.5">
                  <span>{def?.emoji || '📊'} {def?.name || task.dimension_key}</span>
                  <span>·</span>
                  <span>{task.minutes}分钟</span>
                  <span>·</span>
                  <span>{task.quality === 'high' ? '🌟' : task.quality === 'low' ? '😴' : '👌'}</span>
                  {statusLabel && (
                    <>
                      <span>·</span>
                      <span className="text-forest-400">{statusLabel}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                {task.done && task.reward_exp > 0 && (
                  <div className="text-xs text-gold-400">+{task.reward_exp} EXP</div>
                )}
              </div>

              <button
                onClick={() => handleDelete(task.id)}
                className="text-parchment-500 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-parchment-500 text-sm">
            还没有{activeTier === 'daily' ? '每日' : activeTier === 'monthly' ? '月度' : '年度'}任务，点击下方按钮添加
          </div>
        )}
      </div>

      {/* 添加任务 */}
      {showAdd ? (
        <div className="glass-card p-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="任务标题..."
            className="input-field w-full text-sm py-2"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-3">
            <select value={newDimKey} onChange={(e) => setNewDimKey(e.target.value)} className="input-field text-sm py-2">
              {enabledKeys.map((k) => {
                const d = defs[k];
                return <option key={k} value={k}>{d?.emoji || ''} {d?.name || k}</option>;
              })}
            </select>
            <input
              type="number"
              value={newMinutes}
              onChange={(e) => setNewMinutes(Math.max(1, parseInt(e.target.value) || 30))}
              className="input-field text-sm py-2"
              placeholder="分钟"
            />
            <select value={newQuality} onChange={(e) => setNewQuality(e.target.value as any)} className="input-field text-sm py-2">
              <option value="low">😴 较低</option>
              <option value="normal">👌 标准</option>
              <option value="high">🌟 高效</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> 取消
            </button>
            <button onClick={handleAdd} disabled={!newTitle.trim()} className="btn-primary text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> 添加
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border-2 border-dashed border-ink-700 rounded-xl text-parchment-400 hover:text-parchment-200 hover:border-gold-400/40 transition-all text-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加{activeTier === 'daily' ? '每日' : activeTier === 'monthly' ? '月度' : '年度'}任务
        </button>
      )}
    </div>
  );
}
