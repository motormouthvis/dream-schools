"use client";

import Link from "next/link";
import { SupportShell } from "@/components/SupportForms";

export default function FeedbackPage() {
  return (
    <SupportShell
      title="Feedback"
      subtitle="Tell us what works, what’s confusing, what to build next — or report school data that looks wrong. Detailed notes help us fix things faster."
      mode="feedback"
      aside={
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-bold text-ink-900">We especially want to hear about</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
              <li>Missing or incorrect school facts</li>
              <li>Confusing ratings or labels</li>
              <li>Install / embed / popup issues</li>
              <li>Ideas that would help parents or realtors</li>
            </ul>
          </div>
          <Link
            href="/contact"
            className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Need account or partnership help instead? → Contact us
          </Link>
        </>
      }
    />
  );
}
