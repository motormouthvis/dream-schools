import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ nationwide: hasDatabase() });
}
