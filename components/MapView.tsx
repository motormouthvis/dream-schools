"use client";

import { useEffect, useRef } from "react";
import type { LookupResult } from "@/lib/types";
import { scoreHex } from "./score";

// Vanilla Leaflet (free OpenStreetMap tiles, no API key). Loaded only on the
// client. Shows the searched address, the district boundary, and a marker for
// every nearby school (public = green, private = amber). Clicking a school
// marker opens its full detail via the provided callback.
export function MapView({
  data,
  onSelectSchool,
}: {
  data: LookupResult;
  onSelectSchool: (ncesId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      // Inject Leaflet CSS once.
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (cancelled || !ref.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(ref.current, { scrollWheelZoom: false });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // District boundary.
      if (data.districtBoundary) {
        const layer = L.geoJSON(
          { type: "Feature", geometry: data.districtBoundary as any, properties: {} } as any,
          { style: { color: "#12854c", weight: 2, fillColor: "#1fa55f", fillOpacity: 0.06 } }
        ).addTo(map);
        layer.bindTooltip(data.district.name, { sticky: true });
      }

      // Searched address.
      const home = L.circleMarker([data.center.lat, data.center.lon], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#1d4ed8",
        fillOpacity: 1,
      }).addTo(map);
      home.bindPopup(`<b>Your address</b><br/>${escapeHtml(data.geocode.matchedAddress)}`);

      // School markers.
      const bounds = L.latLngBounds([[data.center.lat, data.center.lon]]);
      for (const s of data.nearbySchools) {
        if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
        const isPrivate = s.level === "private";
        const marker = L.marker([s.lat, s.lon], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:${
              isPrivate ? "#d97706" : scoreHex(s.score)
            };color:#fff;border:2px solid #fff;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.4)">${s.score}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        }).addTo(map);
        marker.bindPopup(
          `<b>${escapeHtml(s.name)}</b><br/>${escapeHtml(s.type)} · Grades ${escapeHtml(
            s.grades
          )}<br/>${s.miles} mi · score ${s.score}<br/><a href="#" data-nces="${
            s.ncesId
          }" class="dn-school-link" style="color:#12854c;font-weight:600">View full data →</a>`
        );
        bounds.extend([s.lat, s.lon]);
      }

      map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });

      // Delegate clicks on the "View full data" links inside popups.
      map.getContainer().addEventListener("click", (e: any) => {
        const a = (e.target as HTMLElement)?.closest?.(".dn-school-link") as HTMLElement | null;
        if (a) {
          e.preventDefault();
          const id = a.getAttribute("data-nces");
          if (id) onSelectSchool(id);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div
      ref={ref}
      className="h-80 w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
      style={{ background: "#e8eef3" }}
    />
  );
}

function escapeHtml(s: string): string {
  return (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
