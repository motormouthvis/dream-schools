import { NextResponse } from "next/server";
import { getSchoolDetail } from "@/lib/school";
import { resolveNicheLink } from "@/lib/nicheSlugs";

export const dynamic = "force-dynamic";

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
