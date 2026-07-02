import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        isOwner: user.isOwner,
        isPartner: user.isPartner,
        partnerId: user.partnerId,
        companyName: user.companyName,
        businessName: user.businessName,
        upgradeViewsToTrigger: user.upgradeViewsToTrigger,
        upgradeMinDaysBetween: user.upgradeMinDaysBetween,
        upgradeIdleSeconds: user.upgradeIdleSeconds,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
