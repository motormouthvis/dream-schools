import { to10, rating10Hex, rating10Word } from "./score";

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
  const r10 = to10(score);
  const pct = r10 / 10;
  const dash = circumference * pct;
  const color = rating10Hex(r10);

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
          <span className="text-4xl font-bold tabular-nums text-slate-900">{r10}</span>
          <span className="text-sm font-medium text-slate-400">/10</span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
          {rating10Word(r10)}
        </span>
      </div>
    </div>
  );
}
