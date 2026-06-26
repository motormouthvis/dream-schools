import { scoreHex, scoreBadgeClass, scoreLabel } from "./score";
import type { CategoryScore } from "@/lib/types";

export function CategoryCard({
  category,
  subtitle,
  children,
}: {
  category: CategoryScore;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const color = scoreHex(category.score);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{category.label}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>
            {category.score}
          </span>
          <span
            className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${scoreBadgeClass(
              category.score
            )}`}
          >
            {scoreLabel(category.score)}
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${category.score}%`, backgroundColor: color }}
        />
      </div>

      <dl className="mt-4 space-y-2">
        {category.metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between text-sm">
            <dt className="text-slate-500">{m.label}</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{m.value}</dd>
          </div>
        ))}
      </dl>

      {children}
    </div>
  );
}
