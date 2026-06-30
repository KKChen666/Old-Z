import React, { useState } from 'react';
import { useQuantLifeStore } from '@/stores/useQuantLifeStore';
import { api } from '@/utils/api';
import { Lightbulb, Loader2, Plus, Check, X, Trash2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIPlan() {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();
  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [newStageTitle, setNewStageTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!progressData) return null;

  const aiPlan = progressData.ai_plan_direction;
  const stages = aiPlan.stages || [];

  // 同步本地状态
  if (!goal && aiPlan.goal) {
    // 初始化加载一次
    React.startTransition(() => {
      setGoal(aiPlan.goal);
      setContext(aiPlan.context);
    });
  }

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.quantlife.planDirection(goal.trim(), context.trim(), stages);
      updateProgress((draft) => {
        draft.ai_plan_direction = {
          goal: goal.trim(),
          context: context.trim(),
          main_line: result.main_line || '',
          today_actions: result.today_actions || [],
          stages: stages,
          updated_at: new Date().toISOString(),
        };
      });
      saveProgress();
    } catch (err: any) {
      setError(err.message || 'AI 规划生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = () => {
    if (!newStageTitle.trim()) return;
    updateProgress((draft) => {
      draft.ai_plan_direction.stages.push({
        title: newStageTitle.trim(),
        status: 'active' as const,
      });
    });
    setNewStageTitle('');
    saveProgress();
  };

  const handleToggleStage = (idx: number) => {
    updateProgress((draft) => {
      const stage = draft.ai_plan_direction.stages[idx];
      stage.status = stage.status === 'done' ? 'active' : 'done';
    });
    saveProgress();
  };

  const handleDeleteStage = (idx: number) => {
    updateProgress((draft) => {
      draft.ai_plan_direction.stages.splice(idx, 1);
    });
    saveProgress();
  };

  const handleSaveGoal = () => {
    updateProgress((draft) => {
      draft.ai_plan_direction.goal = goal.trim();
      draft.ai_plan_direction.context = context.trim();
      draft.ai_plan_direction.stages = stages;
    });
    saveProgress();
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-gold-400" />
        <h2 className="text-lg font-serif font-bold text-parchment-100">AI 规划方向</h2>
      </div>

      {/* 目标输入 */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block">你的目标</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="你想达成什么目标？例如：成为一名全栈工程师"
            rows={2}
            className="input-field w-full text-sm resize-none"
          />
        </div>
        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block">背景补充（可选）</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="当前的技能水平、可用时间、资源等..."
            rows={2}
            className="input-field w-full text-sm resize-none"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !goal.trim()}
          className="btn-primary text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          {loading ? 'AI 思考中...' : (aiPlan.main_line ? '重新生成' : '生成策略')}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>
      )}

      {/* 主线策略 */}
      {aiPlan.main_line && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-parchment-100 mb-3">🎯 主线策略</h3>
          <div className="text-sm text-parchment-200 leading-relaxed whitespace-pre-wrap">
            {aiPlan.main_line}
          </div>
        </div>
      )}

      {/* 今日行动 */}
      {aiPlan.today_actions && aiPlan.today_actions.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-parchment-100 mb-3">⚡ 今日行动建议</h3>
          <div className="space-y-2">
            {aiPlan.today_actions.map((action: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-ink-800/40">
                <div className="w-5 h-5 rounded-full bg-gold-400/20 text-gold-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <span className="text-sm text-parchment-200">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 阶段管理 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-parchment-100 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-gold-400" />
          阶段规划
        </h3>

        <div className="space-y-2 mb-4">
          {stages.map((stage: any, i: number) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-all',
                stage.status === 'done' ? 'bg-forest-800/20' : 'bg-ink-800/40'
              )}
            >
              <button
                onClick={() => handleToggleStage(i)}
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  stage.status === 'done'
                    ? 'bg-forest-500 border-forest-500'
                    : 'border-ink-600 hover:border-gold-400'
                )}
              >
                {stage.status === 'done' && <Check className="w-3 h-3 text-ink-950" />}
              </button>
              <span className={cn(
                'text-sm flex-1',
                stage.status === 'done' ? 'text-parchment-500 line-through' : 'text-parchment-200'
              )}>
                {stage.title}
              </span>
              <button
                onClick={() => handleDeleteStage(i)}
                className="text-parchment-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {stages.length === 0 && (
            <div className="text-center py-4 text-parchment-500 text-sm">
              还没有阶段，把大目标拆分成小阶段吧
            </div>
          )}
        </div>

        {/* 添加阶段 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newStageTitle}
            onChange={(e) => setNewStageTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddStage(); }}
            placeholder="新阶段名称..."
            className="input-field flex-1 text-sm py-2"
          />
          <button
            onClick={handleAddStage}
            disabled={!newStageTitle.trim()}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
