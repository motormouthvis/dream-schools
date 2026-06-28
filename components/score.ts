export type ScoreTone = "emerald" | "lime" | "amber" | "orange" | "rose";

export function scoreTone(score: number): ScoreTone {
  if (score >= 85) return "emerald";
  if (score >= 75) return "lime";
  if (score >= 65) return "amber";
  if (score >= 55) return "orange";
  return "rose";
}

const TONE_HEX: Record<ScoreTone, string> = {
  emerald: "#059669",
  lime: "#65a30d",
  amber: "#d97706",
  orange: "#ea580c",
  rose: "#e11d48",
};

export function scoreHex(score: number): string {
  return TONE_HEX[scoreTone(score)];
}

const TONE_BADGE: Record<ScoreTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  lime: "bg-lime-50 text-lime-700 ring-lime-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function scoreBadgeClass(score: number): string {
  return TONE_BADGE[scoreTone(score)];
}

// Good/ok/bad color for an arbitrary metric value.
// higher=true → bigger is better; higher=false → smaller is better.
export function tone(
  value: number | null | undefined,
  good: number,
  bad: number,
  higher = true
): string {
  if (value == null) return "#64748b"; // slate for unknown
  const green = "#059669";
  const amber = "#d97706";
  const red = "#e11d48";
  if (higher) {
    if (value >= good) return green;
    if (value <= bad) return red;
    return amber;
  } else {
    if (value <= good) return green;
    if (value >= bad) return red;
    return amber;
  }
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Very good";
  if (score >= 65) return "Good";
  if (score >= 55) return "Fair";
  return "Needs attention";
}
