"use client";

import { useState } from "react";
import { FAIR_HOUSING_WARNING } from "@/lib/demographicsPrefs";

/**
 * Modal shown when unlocking Full demographics (race/gender) on the public site.
 * Not used in realtor embed/popup.
 */
export function FairHousingAgreeDialog({
  onAgree,
  onCancel,
}: {
  onAgree: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-8"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fh-agree-title"
    >
      <div
        className="my-6 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white">
          <h2 id="fh-agree-title" className="text-base font-bold sm:text-lg">
            Full demographics
          </h2>
          <p className="mt-1 text-xs text-white/85">Requires Fair Housing acknowledgment</p>
        </header>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-700">{FAIR_HOUSING_WARNING}</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              <strong>I agree.</strong> I will not use race, gender, or other protected-class data to
              steer or discriminate, and I will comply with all applicable Fair Housing laws.
            </span>
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!checked}
              onClick={onAgree}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Show full data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
