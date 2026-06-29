"use client";

import { useEffect, useRef, useState } from "react";

export function SettingsMenu({
  view,
  onView,
  audience,
  onAudience,
  onOpenDataSources,
}: {
  view: "list" | "map";
  onView: (v: "list" | "map") => void;
  audience: "full" | "fairhousing";
  onAudience: (a: "full" | "fairhousing") => void;
  onOpenDataSources: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Settings
          </div>

          <div className="px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Schools view</p>
            <Segmented
              value={view}
              onChange={(v) => {
                onView(v as "list" | "map");
                setOpen(false);
              }}
              options={[
                { value: "list", label: "List" },
                { value: "map", label: "Map" },
              ]}
            />
          </div>

          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Data display</p>
            <Segmented
              value={audience}
              onChange={(v) => onAudience(v as "full" | "fairhousing")}
              options={[
                { value: "full", label: "Full" },
                { value: "fairhousing", label: "Fair Housing" },
              ]}
            />
            {audience === "fairhousing" && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                Hides race &amp; gender to prevent steering (Fair Housing).
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenDataSources();
            }}
            className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Data sources <span className="text-slate-300">›</span>
          </button>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-400">
            Custom rating weights
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">
              soon
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex w-full rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1.5 transition ${
            value === o.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
