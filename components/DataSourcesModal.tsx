"use client";

/**
 * Attribution for every external data / mapping source used by School Explorer.
 * Keep in sync with DATA_SOURCES.md.
 */
const SOURCES: {
  name: string;
  vintage: string;
  provider: string;
  access: string;
  used: string;
  attribution: string;
}[] = [
  {
    name: "NCES Common Core of Data (CCD)",
    vintage: "2023–24",
    provider: "National Center for Education Statistics (U.S. Dept. of Education)",
    access: "Urban Institute Education Data API (public mirror)",
    used: "Public-school roster, location, address, phone, enrollment, student-teacher ratio, grade span, charter/magnet/Title I, low-income %, setting, race & gender.",
    attribution: "U.S. Department of Education, NCES Common Core of Data. Via Urban Institute Education Data Portal.",
  },
  {
    name: "Civil Rights Data Collection (CRDC)",
    vintage: "2021–22",
    provider: "U.S. Department of Education, Office for Civil Rights",
    access: "Urban Institute Education Data API (public mirror)",
    used: "Safety & discipline, suspensions, bullying, chronic absenteeism, AP/IB & gifted, SAT/ACT participation, certified teachers, counselors, security, English-learner %.",
    attribution: "U.S. Department of Education, Civil Rights Data Collection. Via Urban Institute Education Data Portal.",
  },
  {
    name: "EDFacts assessments & graduation",
    vintage: "Grad 2018–19; tests 2017–18 / 2019–20",
    provider: "U.S. Department of Education",
    access: "Urban Institute Education Data API (public mirror)",
    used: "4-year graduation rate and state test-score proficiency (reading & math) → Dream Rating / Test Scores.",
    attribution: "U.S. Department of Education EDFacts. Via Urban Institute Education Data Portal.",
  },
  {
    name: "NCES Private School Survey (PSS)",
    vintage: "2021–22",
    provider: "National Center for Education Statistics",
    access: "Direct public CSV download from nces.ed.gov",
    used: "Private schools: location, contact, enrollment, ratio, religious affiliation, coed status, race & gender. (No federal test/grad/safety for private schools.)",
    attribution: "U.S. Department of Education, NCES Private School Universe Survey.",
  },
  {
    name: "U.S. Census school-district boundaries",
    vintage: "2023",
    provider: "U.S. Census Bureau",
    access: "TIGER/Line cartographic boundary shapefiles",
    used: "Which district contains an address (point-in-polygon) and the boundary drawn on the map.",
    attribution: "U.S. Census Bureau, Cartographic Boundary Files.",
  },
  {
    name: "U.S. Census Geocoder",
    vintage: "current",
    provider: "U.S. Census Bureau",
    access: "Public HTTP API (no key)",
    used: "Address → coordinates (primary lookup) and autocomplete coverage.",
    attribution: "U.S. Census Bureau Geocoding Services.",
  },
  {
    name: "Geoapify Geocoding / Autocomplete",
    vintage: "current",
    provider: "Geoapify",
    access: "HTTP API (API key; free tier with paid upgrade path)",
    used: "Primary address autocomplete when configured; falls back to Census + Photon when throttled.",
    attribution: "© Geoapify — geocoding and place suggestions. https://www.geoapify.com/",
  },
  {
    name: "Photon (OpenStreetMap)",
    vintage: "current",
    provider: "Komoot Photon / OpenStreetMap contributors",
    access: "Public HTTP API (no key)",
    used: "Fast typeahead for places/streets and geocoding fallback when Census has no match.",
    attribution: "Data © OpenStreetMap contributors, ODbL. Photon by Komoot.",
  },
  {
    name: "OpenStreetMap map tiles",
    vintage: "current",
    provider: "OpenStreetMap contributors",
    access: "Tile server",
    used: "Map view base layer.",
    attribution: "© OpenStreetMap contributors, https://www.openstreetmap.org/copyright",
  },
];

export function DataSourcesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 backdrop-blur-sm sm:p-8"
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
          <p className="mb-3 text-sm leading-relaxed text-slate-600">
            School facts come from <strong>public U.S. government datasets</strong>. Address search
            also uses Geoapify and OpenStreetMap. The <strong>Dream Rating</strong> (1–10) is
            computed by Dream Neighborhood Schools from those federal inputs — it is not a
            third-party score.
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
                <p className="mt-1 text-xs font-medium text-slate-600">{s.provider}</p>
                <p className="mt-0.5 text-xs text-slate-500">Access: {s.access}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{s.used}</p>
                <p className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] leading-relaxed text-slate-500">
                  <span className="font-semibold text-slate-600">Attribution: </span>
                  {s.attribution}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            Outbound links on school pages (GreatSchools®, Niche™, Google Maps) are for further
            reading only — we do not import their ratings into Dream Rating. Refresh cadence: CCD
            &amp; EDFacts annual; CRDC &amp; PSS biennial; Census boundaries annual.
          </p>
        </div>
      </div>
    </div>
  );
}
