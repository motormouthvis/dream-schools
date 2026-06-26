import { scoreHex, scoreLabel } from "./score";

export function ScoreGauge({
  score,
  size = 132,
}: {
  score: number;
  size?: number;
}) {
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = circumference * pct;
  const color = scoreHex(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline">
          <span className="text-4xl font-bold tabular-nums text-slate-900">{score}</span>
          <span className="text-sm font-medium text-slate-400">/100</span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
          {scoreLabel(score)}
        </span>
      </div>
    </div>
  );
}
