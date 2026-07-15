"use client";

import Link from "next/link";
import { SupportShell } from "@/components/SupportForms";

export default function ContactPage() {
  return (
    <SupportShell
      title="Contact us"
      subtitle="Questions about School Explorer, your account, installation, or partnerships — send a note and we’ll get back to you."
      mode="contact"
      aside={
        <Link
          href="/feedback"
          className="block rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
        >
          Have product feedback or found a data issue? → Open the feedback form
        </Link>
      }
    />
  );
}
