import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";

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
  const result = await geocode(address);
  if (!result) {
    return NextResponse.json({ error: "No match." }, { status: 404 });
  }
  return NextResponse.json(result);
}
