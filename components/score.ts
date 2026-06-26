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

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Very good";
  if (score >= 65) return "Good";
  if (score >= 55) return "Fair";
  return "Needs attention";
}
