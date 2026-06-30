import React, { useState } from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys, calcExp, DIFFICULTY_MULT, QUALITY_MULT, recomputeLevels, deepClone, formatYMDLocal } from '@/stores/useQuantLifeStore';
import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QuickCheckin() {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();
  const [dimensionKey, setDimensionKey] = useState('research');
  const [minutes, setMinutes] = useState(60);
  const [difficulty, setDifficulty] = useState('normal');
  const [quality, setQuality] = useState('normal');
  const [description, setDescription] = useState('');
  const [insightText, setInsightText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!progressData) return null;

  const enabledKeys = getEnabledDimensionKeys(progressData);
  const defs = progressData.meta?.dimensions?.defs || {};
  const date = formatYMDLocal(new Date());

  const handleSubmit = () => {
    const def = defs[dimensionKey];
    const baseRate = def?.exp_config?.base_rate_per_hour || 50;
    const coeff = def?.exp_config?.coefficient || 1.0;
    const diffMult = DIFFICULTY_MULT[difficulty] || 1.0;
    const qualityMult = QUALITY_MULT[quality] || 1.0;
    const expGained = calcExp(minutes, baseRate, diffMult, qualityMult);

    updateProgress((draft) => {
      const entry = {
        date,
        dimension_key: dimensionKey,
        task_type: def?.name || dimensionKey,
        difficulty,
        description: description || `${def?.name || dimensionKey} ${minutes}分钟`,
        exp_gained: expGained,
        completed: true,
      };

      draft.history.push(entry);
      if (!draft.dimensions[dimensionKey]) {
        draft.dimensions[dimensionKey] = { total_exp: 0 };
      }
      draft.dimensions[dimensionKey].total_exp += expGained;
      draft.total_exp += expGained;

      if (!draft.daily_log[date]) {
        draft.daily_log[date] = { date, entries: [], total_exp: 0, all_done: false, insights: [] };
      }
      draft.daily_log[date].entries.push(entry);
      draft.daily_log[date].total_exp += expGained;

      if (insightText.trim()) {
        draft.insights.push(insightText.trim());
      }

      recomputeLevels(draft);
      draft.meta.last_synced_at = new Date().toISOString();
    });

    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    saveProgress();
    setDescription('');
    setInsightText('');
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
        <Zap className="w-4 h-4 text-gold-400" />
        快速打卡
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* 维度选择 */}
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-parchment-400 mb-1 block">维度</label>
          <select
            value={dimensionKey}
            onChange={(e) => setDimensionKey(e.target.value)}
            className="input-field w-full text-sm py-2"
          >
            {enabledKeys.map((key) => {
              const def = defs[key];
              return (
                <option key={key} value={key}>
                  {def?.emoji || ''} {def?.name || key}
                </option>
              );
            })}
          </select>
        </div>

        {/* 时长 */}
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-parchment-400 mb-1 block">时长（分钟）</label>
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Math.min(1440, parseInt(e.target.value) || 60)))}
            className="input-field w-full text-sm py-2"
          />
        </div>

        {/* 难度 */}
        <div>
          <label className="text-xs text-parchment-400 mb-1 block">难度</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="input-field w-full text-sm py-2"
          >
            <option value="easy">😊 轻松</option>
            <option value="normal">💪 正常</option>
            <option value="hard">🔥 困难</option>
          </select>
        </div>

        {/* 质量 */}
        <div>
          <label className="text-xs text-parchment-400 mb-1 block">完成质量</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="input-field w-full text-sm py-2"
          >
            <option value="low">😴 较低</option>
            <option value="normal">👌 标准</option>
            <option value="high">🌟 高效</option>
          </select>
        </div>
      </div>

      {/* 描述 */}
      <div>
        <label className="text-xs text-parchment-400 mb-1 block">活动描述（可选）</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="做了什么..."
          className="input-field w-full text-sm py-2"
        />
      </div>

      {/* 心得 */}
      <div>
        <label className="text-xs text-parchment-400 mb-1 block">心得/反思（可选）</label>
        <textarea
          value={insightText}
          onChange={(e) => setInsightText(e.target.value)}
          placeholder="今天有什么收获或感悟？"
          rows={2}
          className="input-field w-full text-sm resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        className={cn(
          'btn-primary w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2',
          submitted && 'bg-forest-500'
        )}
      >
        {submitted ? (
          <>
            <Check className="w-4 h-4" />
            打卡成功！
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            打卡 (+{calcExp(minutes, (defs[dimensionKey]?.exp_config?.base_rate_per_hour || 50), DIFFICULTY_MULT[difficulty] || 1.0, QUALITY_MULT[quality] || 1.0)} EXP)
          </>
        )}
      </button>
    </div>
  );
}
