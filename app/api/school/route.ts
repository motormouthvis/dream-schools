import { NextResponse } from "next/server";
import { getSchoolDetail } from "@/lib/school";
import { resolveNicheLink } from "@/lib/nicheSlugs";

export const dynamic = "force-dynamic";

/** Simpson diversity → 0–10; same formula as the school-detail UI. */
function diversityIndex10(byRace: { pct: number }[] | undefined): number | null {
  const slices = (byRace || []).filter((s) => s && s.pct > 0);
  if (slices.length === 0) return null;
  const total = slices.reduce((a, s) => a + s.pct, 0) || 100;
  const simpson =
    1 -
    slices.reduce((a, s) => {
      const p = s.pct / total;
      return a + p * p;
    }, 0);
  return Math.max(0, Math.min(10, Math.round(simpson * 10)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ncesId = (searchParams.get("ncesId") ?? "").trim();
  const fairHousing = searchParams.get("fh") === "1";
  if (!ncesId) {
    return NextResponse.json({ error: "Provide ?ncesId=" }, { status: 400 });
  }
  try {
    const detail = await getSchoolDetail(ncesId);
    if (!detail) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }
    // Always attach a scalar diversity index (no race labels) so Limited /
    // Fair Housing mode can still show it on the public website.
    detail.diversityIndex = diversityIndex10(detail.demographics?.byRace);
    // Fair Housing Compliant mode: never return protected-class demographics,
    // so they cannot be used to steer buyers.
    if (fairHousing) {
      detail.demographics = null;
    }
    // Resolve the Niche "more on this school" link (verified slug vs. home).
    detail.niche = await resolveNicheLink(
      detail.name,
      detail.contact.city,
      detail.contact.state
    );
    return NextResponse.json(detail);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
