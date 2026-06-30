import React, { useState } from 'react';
import { useQuantLifeStore } from '@/stores/useQuantLifeStore';
import { PiggyBank, Edit3, Target } from 'lucide-react';

export default function Wealth() {
  const { progressData, updateProgress, saveProgress } = useQuantLifeStore();
  const [editing, setEditing] = useState(false);

  if (!progressData) return null;

  const wealth = progressData.wealth;
  const pct = wealth.target > 0 ? Math.min(100, Math.round((wealth.current / wealth.target) * 100)) : 0;
  const remaining = Math.max(0, wealth.target - wealth.current);

  const [editCurrent, setEditCurrent] = useState(wealth.current);
  const [editTarget, setEditTarget] = useState(wealth.target);
  const [editYear, setEditYear] = useState(wealth.year);

  const handleSave = () => {
    updateProgress((draft) => {
      draft.wealth.current = editCurrent;
      draft.wealth.target = editTarget;
      draft.wealth.year = editYear;
    });
    saveProgress();
    setEditing(false);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <PiggyBank className="w-5 h-5 text-gold-400" />
        <h2 className="text-lg font-serif font-bold text-parchment-100">财富目标</h2>
      </div>

      {/* 进度概览 */}
      <div className="glass-card p-6 text-center">
        <div className="text-4xl font-bold text-gold-400 mb-2">
          ¥{wealth.current.toLocaleString()}
        </div>
        <div className="text-sm text-parchment-400 mb-4">
          目标 ¥{wealth.target.toLocaleString()} ({wealth.year}年)
        </div>

        {/* 进度条 */}
        <div className="w-full max-w-md mx-auto mb-2">
          <div className="flex justify-between text-xs text-parchment-400 mb-1">
            <span>{pct}%</span>
            <span>还差 ¥{remaining.toLocaleString()}</span>
          </div>
          <div className="w-full h-4 bg-ink-800 rounded-full overflow-hidden border border-ink-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            setEditCurrent(wealth.current);
            setEditTarget(wealth.target);
            setEditYear(wealth.year);
            setEditing(!editing);
          }}
          className="btn-ghost text-sm mt-2 flex items-center gap-1 mx-auto"
        >
          <Edit3 className="w-3.5 h-3.5" />
          {editing ? '取消编辑' : '编辑目标'}
        </button>
      </div>

      {/* 编辑表单 */}
      {editing && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-parchment-100 flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-400" />
            修改财富目标
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-parchment-400 mb-1 block">当前存款</label>
              <input
                type="number"
                value={editCurrent}
                onChange={(e) => setEditCurrent(Math.max(0, parseInt(e.target.value) || 0))}
                className="input-field w-full text-sm py-2"
              />
            </div>
            <div>
              <label className="text-xs text-parchment-400 mb-1 block">年度目标</label>
              <input
                type="number"
                value={editTarget}
                onChange={(e) => setEditTarget(Math.max(1, parseInt(e.target.value) || 100000))}
                className="input-field w-full text-sm py-2"
              />
            </div>
            <div>
              <label className="text-xs text-parchment-400 mb-1 block">年份</label>
              <input
                type="number"
                value={editYear}
                onChange={(e) => setEditYear(Math.max(2020, parseInt(e.target.value) || 2026))}
                className="input-field w-full text-sm py-2"
              />
            </div>
          </div>
          <button onClick={handleSave} className="btn-primary text-sm px-6 py-2">
            保存目标
          </button>
        </div>
      )}

      {/* 里程碑 */}
      <div className="glass-card p-4">
        <h4 className="text-sm text-parchment-400 mb-3">进度里程碑</h4>
        <div className="space-y-2">
          {[25, 50, 75, 100].map((milestone) => {
            const reached = pct >= milestone;
            const amount = Math.round(wealth.target * milestone / 100);
            return (
              <div key={milestone} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full border-2 ${
                  reached ? 'bg-gold-400 border-gold-400' : 'bg-transparent border-ink-600'
                }`} />
                <span className={`text-sm ${reached ? 'text-parchment-200' : 'text-parchment-500'}`}>
                  {milestone}% — ¥{amount.toLocaleString()}
                </span>
                {reached && <span className="text-xs text-forest-400">✓ 已达成</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
