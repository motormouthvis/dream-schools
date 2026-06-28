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

// The list chip shares the detail's 1-10 Dream Rating scale so the two never
// disagree (a 0-100 academic score maps to 1-10, then to a color + word).
export function to10(score100: number): number {
  return Math.max(1, Math.min(10, Math.round(score100 / 10) || 1));
}

export function rating10Hex(r10: number): string {
  if (r10 >= 8) return "#059669";
  if (r10 >= 6) return "#65a30d";
  if (r10 >= 4) return "#d97706";
  return "#e11d48";
}

export function rating10Word(r10: number): string {
  if (r10 >= 8) return "Above average";
  if (r10 >= 4) return "Average";
  return "Below average";
}

export function scoreLabel(score: number): string {
  return rating10Word(to10(score));
}
