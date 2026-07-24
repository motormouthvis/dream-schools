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
    let wheelCleanup = () => {};
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      // Custom smooth, speed-based wheel zoom (Google-Maps feel): Leaflet's
      // built-in wheel zoom snaps in steps. We disable it and animate a fractional
      // target zoom toward the cursor, accelerating with faster scrolling.
      // zoomSnap:0 allows fractional zoom levels for smoothness.
      const map = L.map(ref.current, { scrollWheelZoom: false, zoomSnap: 0 });
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

      // --- Smooth, speed-based wheel zoom (Google-Maps feel) ---------------
      const container = map.getContainer();
      let targetZoom = map.getZoom();
      let raf = 0;
      let focusPoint: any = null;
      const animate = () => {
        const cur = map.getZoom();
        const diff = targetZoom - cur;
        if (Math.abs(diff) < 0.008) {
          map.setZoomAround(focusPoint, targetZoom, { animate: false });
          raf = 0;
          return;
        }
        // Ease toward the target each frame → smooth glide instead of steps.
        map.setZoomAround(focusPoint, cur + diff * 0.2, { animate: false });
        raf = requestAnimationFrame(animate);
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (!raf) targetZoom = map.getZoom(); // resync when idle
        const rect = container.getBoundingClientRect();
        focusPoint = L.point(e.clientX - rect.left, e.clientY - rect.top);
        // Normalize delta across mouse (px) / trackpad / line & page modes.
        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 16;
        else if (e.deltaMode === 2) delta *= container.clientHeight;
        // Magnitude = scroll speed → bigger jump on a fast flick, gentle on a nudge.
        const step = Math.max(-1.6, Math.min(1.6, -delta / 240));
        targetZoom = Math.max(map.getMinZoom() ?? 0, Math.min(map.getMaxZoom() ?? 19, targetZoom + step));
        if (!raf) raf = requestAnimationFrame(animate);
      };
      container.addEventListener("wheel", onWheel, { passive: false });
      wheelCleanup = () => {
        container.removeEventListener("wheel", onWheel);
        if (raf) cancelAnimationFrame(raf);
      };

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
      wheelCleanup();
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
