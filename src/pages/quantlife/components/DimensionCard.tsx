import { cn } from '@/lib/utils';
import type { QLProgressData, QLDimensionDef } from '@/types';

interface DimensionCardProps {
  dimKey: string;
  dimDef: QLDimensionDef;
  progressData: QLProgressData;
  onClick?: () => void;
}

export default function DimensionCard({ dimKey, dimDef, progressData, onClick }: DimensionCardProps) {
  const dim = progressData.dimensions[dimKey];
  const totalExp = dim?.total_exp || 0;
  const level = Math.floor(totalExp / 200) + 1;
  const currentLevelExp = totalExp % 200;
  const pct = Math.min(100, Math.round((currentLevelExp / 200) * 100));

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card p-4 transition-all duration-200',
        onClick && 'cursor-pointer hover:border-gold-400/50'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{dimDef.emoji || '📊'}</span>
        <span className="text-sm font-medium text-parchment-200">{dimDef.name}</span>
        <span className="ml-auto text-xs font-mono" style={{ color: dimDef.color }}>
          Lv.{level}
        </span>
      </div>
      <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: dimDef.color }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-parchment-500">
        <span>{totalExp} EXP</span>
        <span>{currentLevelExp} / 200</span>
      </div>
    </div>
  );
}
