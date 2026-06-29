"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Settings2,
  Zap,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";

// Customer admin for the Dream Neighborhood School Explorer popup. Styled to
// match app.dreamneighborhood.com and simplified to a single "Customize Your
// Popup" page that configures one popup. Auth is the shared EMBED_ADMIN_PASSWORD
// (checked server-side); we will replace it with real per-customer auth later.

const INSTALL_SCRIPT = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

interface Partner {
  partnerId: string;
  widgetNumber: number;
  allowedHosts: string[];
  defaultAddress: string;
  accentColor: string;
  position: "left" | "right";
  bottomOffset: number;
  tooltipMessage: string;
  requireAddress: boolean;
  searchPageContent: boolean;
  suppressOnInline: boolean;
  inlineMinHeight: number;
  inlineShowHeader: boolean;
  enabled: boolean;
}

interface FormState {
  partnerId: string;
  authorizedDomain: string;
  defaultAddress: string;
  accentColor: string;
  position: "left" | "right";
  bottomOffset: number;
  tooltipMessage: string;
  requireAddress: boolean;
  searchPageContent: boolean;
  enabled: boolean;
}

const BLANK: FormState = {
  partnerId: "",
  authorizedDomain: "",
  defaultAddress: "",
  accentColor: "#0d5c52",
  position: "right",
  bottomOffset: 0,
  tooltipMessage: "",
  requireAddress: false,
  searchPageContent: false,
  enabled: true,
};

function normalizeHost(raw: string): string {
  let h = (raw || "").trim().toLowerCase();
  if (!h) return "";
  if (h.includes("://")) {
    try {
      h = new URL(h).hostname;
    } catch {
      /* fall through */
    }
  }
  h = h.split("/")[0].split(":")[0];
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}

function partnerToForm(p: Partner): FormState {
  const host = p.allowedHosts[0] || p.partnerId.replace(/^host:/, "");
  return {
    partnerId: p.partnerId,
    authorizedDomain: host,
    defaultAddress: p.defaultAddress,
    accentColor: p.accentColor || "#0d5c52",
    position: p.position,
    bottomOffset: p.bottomOffset,
    tooltipMessage: p.tooltipMessage,
    requireAddress: p.requireAddress,
    searchPageContent: p.searchPageContent,
    enabled: p.enabled,
  };
}

export default function EmbedAdmin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [form, setForm] = useState<FormState>({ ...BLANK });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const headers = useCallback(
    (): HeadersInit => ({
      "Content-Type": "application/json",
      "x-embed-admin-password": password,
    }),
    [password]
  );

  const load = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/embed/admin", { headers: headers() });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to sign in.");
        setAuthed(false);
        return;
      }
      const partners: Partner[] = json.partners ?? [];
      setForm(partners.length ? partnerToForm(partners[0]) : { ...BLANK });
      setAuthed(true);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const copyScript = () => {
    navigator.clipboard?.writeText(INSTALL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function save() {
    setError(null);
    const domain = normalizeHost(form.authorizedDomain);
    if (!domain) {
      setError("Enter the authorized domain for the popup before saving.");
      return;
    }
    setSaving(true);
    const partnerId = form.partnerId || `host:${domain}`;
    try {
      const res = await fetch("/api/embed/admin", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          partnerId,
          widgetNumber: 1,
          allowedHosts: [domain],
          defaultAddress: form.defaultAddress,
          accentColor: form.accentColor,
          position: form.position,
          bottomOffset: form.bottomOffset,
          tooltipMessage: form.tooltipMessage,
          requireAddress: form.requireAddress,
          searchPageContent: form.searchPageContent,
          enabled: form.enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save.");
        return;
      }
      if (json.partner) setForm(partnerToForm(json.partner as Partner));
      setNotice("Popup settings saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  // ---- Login screen -------------------------------------------------------
  if (!authed) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#0d5c52] p-2 shadow-lg shadow-emerald-900/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dn-logo-mark.png"
                alt="Dream Neighborhood Schools"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Dream Neighborhood Schools
            </h1>
            <p className="text-sm text-zinc-500">Customer admin sign-in</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Admin password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={busy || !password}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Sign in
                </>
              )}
            </button>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  // ---- Dashboard ----------------------------------------------------------
  return (
    <AdminShell
      pageTitle="Customize Popup"
      onSignOut={() => {
        setAuthed(false);
        setPassword("");
        setForm({ ...BLANK });
      }}
    >
      <div className="relative mx-auto max-w-5xl pb-24">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Customize Your Popup
            </h1>
            <p className="text-sm text-zinc-500">
              Configure how the Dream Neighborhood School Explorer looks and
              behaves.
            </p>
          </div>
        </div>

        {/* One-time install script */}
        <div className="mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/40 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  One-time installation script
                </div>
                <div className="text-[11px] text-zinc-500">
                  Install this once. Settings below update automatically.
                </div>
              </div>
            </div>
            <button
              onClick={copyScript}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                copied
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
          <div className="overflow-auto rounded-xl border border-emerald-100 bg-white px-4 py-3 font-mono text-[11px] text-emerald-900 shadow-inner">
            {INSTALL_SCRIPT}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Paste before the closing &lt;/body&gt; tag on every page.
          </p>
        </div>

        {/* Explorer settings */}
        <div className="mb-5 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">
            Your Explorer Settings
          </div>
          <div className="mb-5 text-xs text-zinc-500">
            Configure the explorer settings here.
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Default Address
              </label>
              <input
                type="text"
                value={form.defaultAddress}
                onChange={(e) =>
                  setForm({ ...form, defaultAddress: e.target.value })
                }
                placeholder="1500 N 23rd St, Fort Pierce, FL 34950"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Shown in the explorer when no address can be detected on the
                page.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Accent Color
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/30 px-2 py-1.5">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) =>
                    setForm({ ...form, accentColor: e.target.value })
                  }
                  className="h-9 w-9 cursor-pointer rounded-lg border border-zinc-200 bg-transparent"
                />
                <input
                  type="text"
                  value={form.accentColor}
                  onChange={(e) =>
                    setForm({ ...form, accentColor: e.target.value })
                  }
                  className="flex-1 bg-transparent font-mono text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                The accent color of the explorer.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Authorized Domain for Popup
            </label>
            <input
              type="text"
              value={form.authorizedDomain}
              onChange={(e) =>
                setForm({ ...form, authorizedDomain: e.target.value })
              }
              placeholder="www.myrealestatewebsite.com"
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Enter your public site hostname only (no https:// or paths). Used
              to authorize where the popup may load.
            </p>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-900">Enabled</div>
              <div className="text-[11px] text-zinc-500">
                Turn the popup on for the authorized domain. Uncheck to disable
                it without removing the configuration.
              </div>
            </div>
          </label>
        </div>

        {/* Pop-up settings */}
        <div className="mb-5 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">
            Your Pop-Up Settings
          </div>
          <div className="mb-5 text-xs text-zinc-500">
            These options apply to the floating Explorer on your buyer&apos;s
            site.
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Pop-Up Position
              </label>
              <select
                value={form.position}
                onChange={(e) =>
                  setForm({
                    ...form,
                    position: e.target.value as "left" | "right",
                  })
                }
                className={inputCls}
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Pop-Up Bottom Offset (px)
              </label>
              <input
                type="number"
                value={form.bottomOffset}
                onChange={(e) =>
                  setForm({ ...form, bottomOffset: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Offset in pixels from the bottom of the screen, e.g. for a
                sticky banner at the bottom.
              </p>
            </div>
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Tooltip Message
            </label>
            <textarea
              value={form.tooltipMessage}
              onChange={(e) =>
                setForm({ ...form, tooltipMessage: e.target.value })
              }
              rows={3}
              placeholder="See the schools near this property"
              className={`${inputCls} resize-none`}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Leave blank for default wording. Use {"{{address}}"} for the
              detected address.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={form.requireAddress}
                onChange={(e) =>
                  setForm({ ...form, requireAddress: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-900">
                  Only show on pages with a detectable address
                </div>
                <div className="text-[11px] text-zinc-500">
                  Hide the floating button on pages where no address is
                  detected.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={form.searchPageContent}
                onChange={(e) =>
                  setForm({ ...form, searchPageContent: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-900">
                  Search visiting page for an address
                </div>
                <div className="text-[11px] text-zinc-500">
                  If no address is found in the URL, scan the page content for
                  one and use it as the explorer&apos;s default.
                </div>
              </div>
            </label>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}

        {/* Sticky save bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white/95 px-4 py-4 shadow-md backdrop-blur md:left-72 md:px-8">
          {notice && (
            <span className="mr-auto flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" /> {notice}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

const inputCls =
  "w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white";
