"use client";

const SOURCES: { name: string; vintage: string; access: string; used: string }[] = [
  {
    name: "NCES Common Core of Data (CCD)",
    vintage: "2023–24",
    access: "Urban Institute Education Data API (no key)",
    used: "Public-school roster, location, address, phone, enrollment, student-teacher ratio, grade span, charter/magnet/Title I, low-income %, setting, race & gender.",
  },
  {
    name: "U.S. DOE Civil Rights Data Collection (CRDC)",
    vintage: "2021–22",
    access: "Urban Institute Education Data API (no key)",
    used: "Safety & discipline incidents, suspensions, bullying, chronic absenteeism, AP/IB & gifted, SAT/ACT participation, certified teachers, counselors, security, English-learner %.",
  },
  {
    name: "U.S. DOE EDFacts",
    vintage: "Grad 2018–19; tests 2017–18 / 2019–20",
    access: "Urban Institute Education Data API (no key)",
    used: "4-year graduation rate and state test-score proficiency (reading & math) → Test Scores rating.",
  },
  {
    name: "NCES Private School Survey (PSS)",
    vintage: "2021–22",
    access: "Direct CSV download from nces.ed.gov",
    used: "Private schools: location, contact, enrollment, ratio, religious affiliation, coed status, race & gender. (No test/grad/safety — federal collections cover public schools only.)",
  },
  {
    name: "U.S. Census school-district boundaries",
    vintage: "2023",
    access: "Direct shapefile download from census.gov",
    used: "Which district contains an address (point-in-polygon) and the boundary drawn on the map.",
  },
  {
    name: "U.S. Census Geocoder",
    vintage: "current",
    access: "HTTP API (no key)",
    used: "Address → coordinates (primary) and autocomplete suggestions.",
  },
  {
    name: "Photon (OpenStreetMap)",
    vintage: "current",
    access: "HTTP API (no key)",
    used: "Address autocomplete and geocoding fallback.",
  },
  {
    name: "OpenStreetMap tiles",
    vintage: "current",
    access: "Tile server (no key)",
    used: "Map base layer.",
  },
];

export function DataSourcesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white">
          <h2 className="text-base font-bold sm:text-lg">Data sources</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25"
          >
            ✕
          </button>
        </header>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Every figure comes from <strong>public U.S. government data</strong> — nothing is
            fabricated. Ratings are transparently computed from these inputs.
          </p>
          <ul className="space-y-3">
            {SOURCES.map((s) => (
              <li key={s.name} className="rounded-xl bg-slate-50 p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{s.name}</h3>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                    {s.vintage}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{s.access}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{s.used}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            All sources are public-domain / open data and free. Refresh cadence: CCD &amp; EDFacts
            annual; CRDC &amp; PSS biennial; Census boundaries annual.
          </p>
        </div>
      </div>
    </div>
  );
}
