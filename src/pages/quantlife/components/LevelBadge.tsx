interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-20 h-20 text-2xl',
    lg: 'w-28 h-28 text-4xl',
  };

  const ringColors = [
    'from-ink-700 to-ink-600',       // Lv.1-5
    'from-forest-600 to-forest-500',  // Lv.6-15
    'from-blue-600 to-blue-500',      // Lv.16-30
    'from-purple-600 to-purple-500',  // Lv.31-50
    'from-gold-600 to-gold-400',      // Lv.51-100
    'from-red-500 to-orange-500',     // Lv.101+
  ];

  let ringIdx = 0;
  if (level > 100) ringIdx = 5;
  else if (level > 50) ringIdx = 4;
  else if (level > 30) ringIdx = 3;
  else if (level > 15) ringIdx = 2;
  else if (level > 5) ringIdx = 1;

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${ringColors[ringIdx]} p-0.5 flex items-center justify-center`}>
      <div className="w-full h-full rounded-full bg-ink-900 flex items-center justify-center">
        <span className="font-bold text-gold-400 font-mono">{level}</span>
      </div>
    </div>
  );
}
