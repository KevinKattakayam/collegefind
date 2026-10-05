'use client';
import { useRef, useEffect } from 'react';
import { College } from '@/types';

interface Props {
  colleges: College[];
}

type MetricKey = 'placementPct' | 'avgPackage' | 'totalStudents' | 'annualFees';
const METRICS: { key: MetricKey; label: string; max: number; invert?: boolean }[] = [
  { key: 'placementPct', label: 'Placement %', max: 100 },
  { key: 'avgPackage', label: 'Avg Package', max: 30 },
  { key: 'totalStudents', label: 'Students', max: 50000 },
  { key: 'annualFees', label: 'Fees', max: 3500000, invert: true },
];

const COLORS = [
  { fill: 'rgba(37, 99, 235, 0.15)', stroke: '#2563EB' },
  { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#F97316' },
  { fill: 'rgba(22, 163, 74, 0.15)', stroke: '#16A34A' },
];

export default function RadarChart({ colleges }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || colleges.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement?.clientWidth || 400, 400);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.35;
    const count = METRICS.length;
    const angleStep = (Math.PI * 2) / count;

    ctx.clearRect(0, 0, size, size);

    // Draw grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (radius * ring) / 4;
      ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axis lines and labels
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Labels
      const labelX = cx + (radius + 20) * Math.cos(angle);
      const labelY = cy + (radius + 20) * Math.sin(angle);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(METRICS[i].label, labelX, labelY);
    }

    // Draw data polygons
    colleges.forEach((college, colIdx) => {
      const color = COLORS[colIdx] || COLORS[0];
      ctx.beginPath();

      for (let i = 0; i < count; i++) {
        const metric = METRICS[i];
        const rawValue = college[metric.key] ?? 0;
        let normalized = Math.min(rawValue / metric.max, 1);
        if (metric.invert) normalized = 1 - normalized;

        const angle = i * angleStep - Math.PI / 2;
        const r = radius * Math.max(normalized, 0.05);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fillStyle = color.fill;
      ctx.fill();
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw data points
      for (let i = 0; i < count; i++) {
        const metric = METRICS[i];
        const rawValue = college[metric.key] ?? 0;
        let normalized = Math.min(rawValue / metric.max, 1);
        if (metric.invert) normalized = 1 - normalized;

        const angle = i * angleStep - Math.PI / 2;
        const r = radius * Math.max(normalized, 0.05);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color.stroke;
        ctx.fill();
      }
    });
  }, [colleges]);

  if (colleges.length < 2) return null;

  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
      <h3 className="font-bold text-lg text-[#1E293B] mb-4">Visual Comparison</h3>
      <div className="flex justify-center">
        <canvas ref={canvasRef} />
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
        {colleges.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i]?.stroke || COLORS[0].stroke }} />
            <span className="text-xs font-medium text-[#475569]">{c.shortName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
