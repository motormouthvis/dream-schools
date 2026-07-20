import { NextResponse } from "next/server";
import { currentUser, getPartnerBranding, impersonatorFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    const partnerBranding =
      !user.isPartner && user.partnerId ? await getPartnerBranding(user.partnerId) : null;
    // If a partner/admin is viewing this account, expose who (for the banner).
    const impersonator = await impersonatorFromRequest(request);
    const impersonating =
      impersonator && impersonator.id !== user.id
        ? {
            by: {
              id: impersonator.id,
              email: impersonator.email,
              name: impersonator.companyName || impersonator.businessName || impersonator.email,
              isOwner: impersonator.isOwner,
            },
          }
        : null;
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        isOwner: user.isOwner,
        isPartner: user.isPartner,
        partnerId: user.partnerId,
        companyName: user.companyName,
        businessName: user.businessName,
        inheritedWhiteLabel: partnerBranding?.inheritedWhiteLabel || "",
        upgradeViewsToTrigger: user.upgradeViewsToTrigger,
        upgradeMinDaysBetween: user.upgradeMinDaysBetween,
        upgradeIdleSeconds: user.upgradeIdleSeconds,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      impersonating,
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
