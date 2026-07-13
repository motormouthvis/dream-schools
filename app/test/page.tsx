"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Isolated smoke-test entry: passwordless admin login for production QA.
 * Requires SMOKE_TEST_SECRET on the dyno. Visit /test?key=SECRET
 */
function SmokeTestLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [key, setKey] = useState(params.get("key") || "");
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function doLogin(secret: string) {
    setStatus("working");
    setMessage("Signing in as smoke admin…");
    try {
      const res = await fetch(`/api/auth/smoke?key=${encodeURIComponent(secret)}`, {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || `Login failed (${res.status})`);
        return;
      }
      setStatus("ok");
      setMessage(`Signed in as ${data.email}. Opening dashboard…`);
      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Network error");
    }
  }

  useEffect(() => {
    const q = params.get("key");
    if (q) void doLogin(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    void doLogin(key.trim());
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Smoke test</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">
        Dream Neighborhood Schools
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Passwordless isolated admin for production smoke testing. Not a customer account.
        Requires the server <code className="text-xs">SMOKE_TEST_SECRET</code>.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-semibold text-ink-900">
          Smoke key
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Paste SMOKE_TEST_SECRET"
          />
        </label>
        <button
          type="submit"
          disabled={status === "working" || !key.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === "working" ? "Signing in…" : "Enter as smoke admin"}
        </button>
      </form>

      {message ? (
        <p
          className={`mt-4 text-sm ${
            status === "error" ? "text-red-700" : status === "ok" ? "text-brand-700" : "text-slate-600"
          }`}
        >
          {message}
        </p>
      ) : null}
    </main>
  );
}

export default function SmokeTestPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Loading…</main>}>
      <SmokeTestLoginInner />
    </Suspense>
  );
}
