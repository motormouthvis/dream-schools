"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LookupResult, NearbySchool } from "@/lib/types";
import { to10, rating10Hex } from "./score";

// Vanilla Leaflet (free OpenStreetMap tiles, no API key). Loaded only on the
// client. Shows the searched address, the district boundary, and a marker for
// every nearby school (public = green, private = amber). Clicking a school
// marker opens its full detail via the provided callback.
export function MapView({
  data,
  schools,
  onSelectSchool,
  heightClass = "h-80",
}: {
  data: LookupResult;
  schools?: NearbySchool[];
  onSelectSchool: (ncesId: string) => void;
  heightClass?: string;
}) {
  const pins = schools ?? data.nearbySchools;
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(ref.current, { scrollWheelZoom: false });
      mapRef.current = map;
      // Give the map a valid view BEFORE adding any vector layers (e.g. the
      // district-boundary polygon). Without an initial view the map has no pixel
      // bounds and Leaflet's polygon clipping throws in production builds.
      const startCenter: [number, number] =
        Number.isFinite(data.center.lat) && Number.isFinite(data.center.lon)
          ? [data.center.lat, data.center.lon]
          : [39.5, -98.35];
      map.setView(startCenter, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // District boundary (non-critical — never let it block school markers).
      if (data.districtBoundary) {
        try {
          const layer = L.geoJSON(
            { type: "Feature", geometry: data.districtBoundary as any, properties: {} } as any,
            { style: { color: "#12854c", weight: 2, fillColor: "#1fa55f", fillOpacity: 0.06 } }
          ).addTo(map);
          layer.bindTooltip(data.district.name, { sticky: true });
        } catch {
          /* ignore boundary render issues */
        }
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

      // School markers — labeled with the same number as the list below.
      const bounds = L.latLngBounds([[data.center.lat, data.center.lon]]);
      pins.forEach((s, i) => {
        if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
        const isPrivate = s.level === "private";
        const num = i + 1;
        const marker = L.marker([s.lat, s.lon], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:${
              s.score == null ? "#94a3b8" : isPrivate ? "#d97706" : rating10Hex(to10(s.score))
            };color:#fff;border:2px solid #fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,.4)">${num}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(map);
        // Hover/tap label with the name; clicking the pin opens full details.
        marker.bindTooltip(`${num}. ${escapeHtml(s.name)}`, { direction: "top", offset: [0, -10] });
        marker.on("click", () => onSelectSchool(s.ncesId));
        bounds.extend([s.lat, s.lon]);
      });

      map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
      // The container may have been hidden (List view) when initialized; force a
      // resize + refit so tiles and pins render correctly once visible.
      setTimeout(() => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
        }
      }, 120);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pins]);

  return (
    <div
      ref={ref}
      className={`${heightClass} isolate w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm`}
      style={{ background: "#e8eef3", zIndex: 0 }}
    />
  );
}

function escapeHtml(s: string): string {
  return (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
