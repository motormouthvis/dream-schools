"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { NearbySchools } from "@/components/NearbySchools";
import type { LookupResult } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

// The sophisticated inline "full" embed: an editorial "Nearby Schools" module
// that shows the list AND the map together, with Public/Private + sort filters.
// Detail is rendered by the parent (SchoolDetailModal) so it fills the same box.
export function NearbySchoolsFull({
  data,
  onOpenSchool,
}: {
  data: LookupResult;
  onOpenSchool: (ncesId: string) => void;
}) {
  const INITIAL = 8;
  const [filterType, setFilterType] = useState<"all" | "public" | "private">("all");
  const [sortBy, setSortBy] = useState<"distance" | "rating">("distance");
  const [listLimit, setListLimit] = useState(INITIAL);

  const visibleSchools = useMemo(() => {
    let list = data.nearbySchools.slice();
    if (filterType !== "all") {
      list = list.filter((s) => (filterType === "private" ? s.level === "private" : s.level !== "private"));
    }
    list.sort((a, b) => (sortBy === "rating" ? (b.score ?? -1) - (a.score ?? -1) : a.miles - b.miles));
    return list;
  }, [data.nearbySchools, filterType, sortBy]);

  const noop = () => {};
  const shown = visibleSchools.slice(0, listLimit);
  const remaining = visibleSchools.length - shown.length;

  // Page-flow (Zillow/GreatSchools style): no fixed height, no inner scrollbar —
  // the section is as tall as its content and scrolls with the host page.
  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Nearby Schools</h2>
        <span className="text-xs text-slate-400">{visibleSchools.length} nearby</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Show</span>
          <Seg active={filterType === "all"} onClick={() => setFilterType("all")}>All</Seg>
          <Seg active={filterType === "public"} onClick={() => setFilterType("public")}>Public</Seg>
          <Seg active={filterType === "private"} onClick={() => setFilterType("private")}>Private</Seg>
          <span className="ml-1.5 text-[11px] font-semibold text-slate-400">Sort</span>
          <Seg active={sortBy === "distance"} onClick={() => setSortBy("distance")}>Distance</Seg>
          <Seg active={sortBy === "rating"} onClick={() => setSortBy("rating")}>Rating</Seg>
        </div>
      </div>

      {/* List + map together — natural height, flows with the page. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          {shown.length > 0 ? (
            <>
              <NearbySchools
                schools={shown}
                onSelect={onOpenSchool}
                compareIds={[]}
                onToggleCompare={noop}
                showCompare={false}
                unratedGradCap
              />
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setListLimit((n) => n + 8)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
                >
                  Show {Math.min(8, remaining)} more ({remaining} more nearby)
                </button>
              )}
              {listLimit > INITIAL && (
                <button
                  type="button"
                  onClick={() => setListLimit(INITIAL)}
                  className="mt-2 w-full py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
                >
                  Show fewer
                </button>
              )}
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              No {filterType === "all" ? "" : filterType + " "}schools in this area.
            </p>
          )}
        </div>

        {/* Map: a normal block (no inner scroll). On desktop it sticks while the
            page scrolls the list; on mobile it sits above the list. */}
        <div className="order-first lg:order-none lg:sticky lg:top-3 lg:self-start">
          <MapView
            data={data}
            schools={visibleSchools}
            onSelectSchool={onOpenSchool}
            heightClass="h-[300px] lg:h-[520px]"
          />
          <p className="mt-1.5 px-1 text-center text-[11px] leading-relaxed text-slate-400">
            📍 your address · 🟠 private · shaded area = {data.district.name}
          </p>
        </div>
      </div>
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
        active ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
