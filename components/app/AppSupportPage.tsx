"use client";

import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { SupportContent, SupportShell } from "@/components/SupportForms";

/**
 * Contact / Feedback: public www chrome on the marketing host; app sidebar
 * (AppShell) on app.* so signed-in users can navigate back.
 */
export function AppSupportPage({
  mode,
  isApp,
}: {
  mode: "contact" | "feedback";
  isApp: boolean;
}) {
  if (mode === "contact") {
    const title = "Contact us";
    const subtitle =
      "Questions about School Explorer, your account, installation, or partnerships — send a note and we’ll get back to you.";
    const aside = (
      <Link
        href="/feedback"
        className="block rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
      >
        Have product feedback or found a data issue? → Open the feedback form
      </Link>
    );
    if (isApp) {
      return (
        <AppShell active="contact">
          {() => <SupportContent title={title} subtitle={subtitle} mode="contact" aside={aside} compact />}
        </AppShell>
      );
    }
    return <SupportShell title={title} subtitle={subtitle} mode="contact" aside={aside} />;
  }

  const title = "Feedback";
  const subtitle =
    "Tell us what works, what’s confusing, what to build next — or report school data that looks wrong. Detailed notes help us fix things faster.";
  const aside = (
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
  );
  if (isApp) {
    return (
      <AppShell active="contact">
        {() => <SupportContent title={title} subtitle={subtitle} mode="feedback" aside={aside} compact />}
      </AppShell>
    );
  }
  return <SupportShell title={title} subtitle={subtitle} mode="feedback" aside={aside} />;
}
