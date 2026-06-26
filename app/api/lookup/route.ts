import { NextResponse } from "next/server";
import { lookupAddress } from "@/lib/lookup";
import { lookupAddressDb } from "@/lib/lookupDb";
import { hasDatabase } from "@/lib/db";
import type { GeocodeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").trim();

  if (!address) {
    return NextResponse.json(
      { error: "Provide an ?address= query parameter." },
      { status: 400 }
    );
  }

  // If a suggestion was picked from autocomplete, its coordinates are passed
  // through so we can skip a second geocode.
  const latParam = parseFloat(searchParams.get("lat") ?? "");
  const lonParam = parseFloat(searchParams.get("lon") ?? "");
  const presetGeo: GeocodeResult | undefined =
    Number.isFinite(latParam) && Number.isFinite(lonParam)
      ? {
          matchedAddress: address,
          lat: latParam,
          lon: lonParam,
          zip: searchParams.get("zip") ?? "",
          source: "autocomplete",
          approximate: false,
        }
      : undefined;

  try {
    if (hasDatabase()) {
      // Nationwide path (Postgres + PostGIS).
      const result = await lookupAddressDb(address, presetGeo);
      if (!result) {
        return NextResponse.json(
          {
            error:
              "Could not geocode that address, or no schools were found nearby. Try a full US street address including city/state or zip.",
          },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    // Demo path (committed JSON bundle, 10 zip codes around 34946).
    const result = await lookupAddress(address, presetGeo);
    if (!result) {
      return NextResponse.json(
        { error: "Could not geocode that address. Try including a zip code." },
        { status: 404 }
      );
    }
    const nearestMiles = result.nearbySchools[0]?.miles ?? Infinity;
    const outOfArea =
      !Number.isFinite(result.geocode.lat) ||
      (!result.district.inDistrict && nearestMiles > 25);
    if (outOfArea) {
      return NextResponse.json(
        {
          error:
            "That address is outside the demo coverage area. This JSON demo only covers 10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL): 34946, 34947, 34950, 34951, 34981, 34982, 34983, 34984, 34986, 34987. Set DATABASE_URL to enable nationwide lookups.",
          geocode: result.geocode,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal error performing lookup." },
      { status: 500 }
    );
  }
}
