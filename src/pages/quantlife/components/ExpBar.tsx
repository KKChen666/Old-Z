interface ExpBarProps {
  current: number;
  max: number;
  level: number;
  showLabel?: boolean;
}

export default function ExpBar({ current, max, level, showLabel = true }: ExpBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-parchment-400">Lv.{level}</span>
          <span className="text-xs text-parchment-400">{current} / {max} EXP</span>
        </div>
      )}
      <div className="w-full h-3 bg-ink-800 rounded-full overflow-hidden border border-ink-700/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
