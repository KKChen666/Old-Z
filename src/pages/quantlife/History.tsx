import React, { useState } from 'react';
import { useQuantLifeStore, getEnabledDimensionKeys } from '@/stores/useQuantLifeStore';
import { Search } from 'lucide-react';

export default function History() {
  const { progressData } = useQuantLifeStore();
  const [search, setSearch] = useState('');
  const [filterDim, setFilterDim] = useState('all');

  if (!progressData) return null;

  const defs = progressData.meta?.dimensions?.defs || {};
  const enabledKeys = getEnabledDimensionKeys(progressData);

  let entries = [...progressData.history].reverse();

  if (search.trim()) {
    const q = search.toLowerCase();
    entries = entries.filter((e) =>
      e.description.toLowerCase().includes(q) ||
      e.task_type.toLowerCase().includes(q) ||
      e.dimension_key.toLowerCase().includes(q)
    );
  }

  if (filterDim !== 'all') {
    entries = entries.filter((e) => e.dimension_key === filterDim);
  }

  // 分页
  const [page, setPage] = useState(0);
  const pageSize = 30;
  const totalPages = Math.ceil(entries.length / pageSize);
  const paged = entries.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* 搜索和筛选 */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-parchment-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="搜索活动描述..."
            className="input-field w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterDim}
          onChange={(e) => { setFilterDim(e.target.value); setPage(0); }}
          className="input-field text-sm py-2 px-3"
        >
          <option value="all">全部维度</option>
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

      {/* 统计摘要 */}
      <div className="text-xs text-parchment-400">
        共 {entries.length} 条记录 · 总 {progressData.total_exp.toLocaleString()} EXP
      </div>

      {/* 记录列表 */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800/50">
              <th className="text-left p-3 text-xs text-parchment-400 font-medium">日期</th>
              <th className="text-left p-3 text-xs text-parchment-400 font-medium">维度</th>
              <th className="text-left p-3 text-xs text-parchment-400 font-medium">描述</th>
              <th className="text-left p-3 text-xs text-parchment-400 font-medium hidden sm:table-cell">难度</th>
              <th className="text-right p-3 text-xs text-parchment-400 font-medium">EXP</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((entry, i) => {
              const def = defs[entry.dimension_key];
              return (
                <tr key={i} className="border-b border-ink-800/20 hover:bg-ink-800/30 transition-colors">
                  <td className="p-3 text-parchment-300 font-mono text-xs">{entry.date}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1">
                      <span>{def?.emoji || '📊'}</span>
                      <span className="text-xs text-parchment-300">{def?.name || entry.dimension_key}</span>
                    </span>
                  </td>
                  <td className="p-3 text-parchment-200">{entry.description}</td>
                  <td className="p-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.difficulty.includes('hard') ? 'bg-red-500/20 text-red-400' :
                      entry.difficulty.includes('easy') ? 'bg-green-500/20 text-green-400' :
                      'bg-ink-700 text-parchment-400'
                    }`}>
                      {entry.difficulty.includes('hard') ? '困难' :
                       entry.difficulty.includes('easy') ? '轻松' : '正常'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-gold-400 font-semibold">+{entry.exp_gained}</span>
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-parchment-500">
                  {entries.length === 0 ? '暂无历史记录' : '没有匹配的记录'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-xs text-parchment-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
