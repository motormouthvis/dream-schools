"use client";

import { AppShell } from "@/components/app/AppShell";

export default function OwnerPage() {
  return (
    <AppShell active="owner">
      {(me) =>
        me.isOwner ? (
          <>
            <h1 className="text-xl font-extrabold text-ink-900">Owner Admin</h1>
            <p className="mt-2 text-sm text-slate-600">
              The customers table (signups, usage, sort/search/edit/delete) is being built next.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-ink-900">Not authorized</h1>
            <p className="mt-2 text-sm text-slate-600">This area is for the account owner.</p>
          </>
        )
      }
    </AppShell>
  );
}
