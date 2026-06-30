import React from 'react';
import {
  Radar,
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { QLProgressData } from '@/types';
import { getEnabledDimensionKeys } from '@/stores/useQuantLifeStore';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  progressData: QLProgressData;
}

export default function RadarChart({ progressData }: RadarChartProps) {
  const enabledKeys = getEnabledDimensionKeys(progressData);
  const defs = progressData.meta?.dimensions?.defs || {};

  // 找出最高等级用于动态缩放
  let maxLevel = 1;
  const labels: string[] = [];
  const dataPoints: number[] = [];
  const colors: string[] = [];

  for (const key of enabledKeys) {
    const def = defs[key];
    const dim = progressData.dimensions[key];
    if (!def || def.archived) continue;
    const level = dim ? Math.floor(dim.total_exp / 200) + 1 : 1;
    if (level > maxLevel) maxLevel = level;
    labels.push(`${def.emoji || ''} ${def.name}`);
    dataPoints.push(level);
    colors.push(def.color || '#888');
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: '维度等级',
        data: dataPoints,
        backgroundColor: colors.map(c => c + '33'),
        borderColor: colors,
        borderWidth: 2,
        pointBackgroundColor: colors,
        pointBorderColor: '#1e1e1e',
        pointBorderWidth: 2,
        pointRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true,
        max: Math.max(maxLevel + 1, 5),
        ticks: {
          stepSize: 1,
          color: '#9a8a5a',
          backdropColor: 'transparent',
          font: { size: 10 },
        },
        grid: {
          color: '#2a2a2a',
        },
        angleLines: {
          color: '#2a2a2a',
        },
        pointLabels: {
          color: '#c49240',
          font: { size: 12, family: "'Noto Sans SC', sans-serif" },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e1e1e',
        titleColor: '#f5f0e8',
        bodyColor: '#c49240',
        borderColor: '#2a2a2a',
        borderWidth: 1,
      },
    },
  };

  return (
    <div className="w-full aspect-square max-w-[320px] mx-auto">
      <Radar data={chartData} options={options} />
    </div>
  );
}
