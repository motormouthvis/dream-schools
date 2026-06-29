"use client";

import { useEffect, useState } from "react";

interface Review {
  id: number;
  rating: number;
  author: string;
  role: string;
  comment: string;
  created_at: string;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`${value} of 5`}>
      {"★".repeat(value)}
      <span className="text-slate-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function Reviews({ ncesId }: { ncesId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState("");
  const [role, setRole] = useState("parent");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/reviews?ncesId=${encodeURIComponent(ncesId)}`);
      const j = await res.json();
      setReviews(j.reviews ?? []);
      setAverage(j.average ?? null);
      setCount(j.count ?? 0);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ncesId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncesId, rating, author, role, comment }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error ?? "Could not submit.");
      } else {
        setComment("");
        setAuthor("");
        setShowForm(false);
        setMsg("Thanks! Your review was posted.");
        load();
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Community reviews
        </h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          {showForm ? "Cancel" : "Write a review"}
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2 text-sm">
        {average != null ? (
          <>
            <Stars value={Math.round(average)} />
            <span className="font-semibold text-slate-800">{average.toFixed(1)}</span>
            <span className="text-slate-400">({count})</span>
          </>
        ) : (
          <span className="text-slate-400">No reviews yet — be the first.</span>
        )}
      </div>

      {msg && <p className="mt-2 text-xs text-brand-700">{msg}</p>}

      {showForm && (
        <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ★
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="parent">Parent</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="community">Community</option>
            </select>
          </div>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this school…"
            rows={3}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Posting…" : "Post review"}
          </button>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {reviews.slice(0, 5).map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-center justify-between">
              <Stars value={r.rating} />
              <span className="text-[11px] capitalize text-slate-400">{r.role}</span>
            </div>
            <p className="mt-1 text-xs text-slate-700">{r.comment}</p>
            <p className="mt-1 text-[10px] text-slate-400">
              — {r.author || "Anonymous"} ·{" "}
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
