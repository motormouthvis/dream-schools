import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({
      user: {
        email: user.email,
        isOwner: user.isOwner,
        isPartner: user.isPartner,
        partnerId: user.partnerId,
        companyName: user.companyName,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
