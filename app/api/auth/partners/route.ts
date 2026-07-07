import { NextResponse } from "next/server";
import { listPartnerAccounts } from "@/lib/owner";

export const dynamic = "force-dynamic";

// Public list of partners for the signup dropdown. Exposes only id + display
// name (company name) — never emails — and only partners that have set a
// company name, so a self-serve signup can attribute themselves to a partner.
export async function GET() {
  try {
    const partners = await listPartnerAccounts();
    const list = partners
      .map((p) => ({ id: p.id, name: (p.companyName || "").trim() }))
      .filter((p) => p.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ partners: list });
  } catch {
    return NextResponse.json({ partners: [] });
  }
}
