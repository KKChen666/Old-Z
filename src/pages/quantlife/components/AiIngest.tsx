import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { api } from '@/utils/api';
import { cn } from '@/lib/utils';

interface AiIngestProps {
  date: string;
  hintDimensionKey?: string;
  onIngested: (result: any) => void;
}

export default function AiIngest({ date, hintDimensionKey, onIngested }: AiIngestProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.quantlife.ingestText(date, text.trim(), hintDimensionKey);
      setResult(res);
      onIngested(res);
    } catch (err: any) {
      setError(err.message || 'AI 解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="用自然语言描述你做了什么...&#10;例如：今天看了一小时文献，中等难度，然后又去健身房跑了40分钟"
          rows={3}
          className="input-field flex-1 resize-none text-sm"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className={cn(
            'btn-primary self-end p-2.5 rounded-lg',
            (loading || !text.trim()) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs text-parchment-400">
            解析到 {result.parsed?.length || 0} 个活动条目：
          </div>
          {result.parsed?.map((entry: any, i: number) => (
            <div key={i} className="glass-card p-3 flex items-center gap-3">
              <span className="text-lg">
                {result.progress?.meta?.dimensions?.defs?.[entry.dimension_key]?.emoji || '📊'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-parchment-200 truncate">{entry.description}</div>
                <div className="text-xs text-parchment-500">
                  {entry.task_type} · {entry.difficulty}
                </div>
              </div>
              <span className="text-sm font-bold text-gold-400 whitespace-nowrap">
                +{entry.exp_gained} EXP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
