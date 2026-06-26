import { NextResponse } from "next/server";
import { lookupAddress } from "@/lib/lookup";

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

  try {
    const result = await lookupAddress(address);
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
            "That address is outside the demo coverage area. This demo only covers 10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL): 34946, 34947, 34950, 34951, 34981, 34982, 34983, 34984, 34986, 34987.",
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
