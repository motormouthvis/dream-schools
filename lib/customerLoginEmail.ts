import { emailShell, htmlEscape, sendTransactionalEmail } from "@/lib/email";

// Default intro for the "manage your School Explorer" email. Partners/admins can
// edit this in Account Settings. `{company}` is replaced with their business name.
export const DEFAULT_CUSTOMER_LOGIN_INTRO =
  "{company} has added a free School Explorer to your website and set everything up for you — there's nothing you need to do, and it's already live for your visitors. If you'd like to review or change any settings yourself, just click below to access your account.";

export function fillCustomerLoginIntro(text: string, providerName: string): string {
  const raw = (text || "").trim() || DEFAULT_CUSTOMER_LOGIN_INTRO;
  return raw.replace(/\{company\}/gi, providerName || "Your real estate partner");
}

export async function sendCustomerLoginLinkEmail(opts: {
  to: string;
  customerName?: string;
  providerName: string;
  introText: string; // raw (may contain {company}); "" uses the default
  ctaUrl: string;
  domain?: string;
}): Promise<void> {
  const intro = fillCustomerLoginIntro(opts.introText, opts.providerName);
  const provider = opts.providerName?.trim();
  const subject = provider
    ? `${provider}: manage your free School Explorer`
    : "Manage your free School Explorer";

  const html = emailShell(
    `<div style="background:#f8fbf4;border:1px solid #dcebd5;border-radius:24px;overflow:hidden">
       <div style="background:linear-gradient(135deg,#fbfff1 0%,#effdd1 48%,#dcfce7 100%);padding:24px;border-bottom:1px solid #d9f99d">
         <div style="display:inline-block;background:#ffffff;border:1px solid #bbf7d0;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;color:#12854c">Dream Neighborhood&trade; Schools</div>
         <h1 style="font-size:22px;line-height:1.25;margin:0 0 8px;color:#102a1d">Your free School Explorer is live</h1>
         <p style="font-size:14px;line-height:1.6;margin:0;color:#31523d">Nearby school ratings and details, right on your listings.</p>
       </div>
       <div style="padding:20px 22px">
         ${opts.customerName ? `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 12px">Hi ${htmlEscape(opts.customerName)},</p>` : ""}
         <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 16px">${htmlEscape(intro)}</p>
         <div style="text-align:center;background:#ffffff;border:1px solid #bbf7d0;border-radius:20px;padding:18px;margin:0 0 16px">
           <div style="font-size:16px;font-weight:900;color:#0f172a;line-height:1.25;margin:0 0 12px">Manage your School Explorer</div>
           <a href="${htmlEscape(opts.ctaUrl)}" style="display:inline-block;background:#12854c;color:#ffffff;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px">Access my account</a>
           <p style="font-size:12px;color:#94a3b8;line-height:1.5;margin:12px 0 0">This secure link lets you set a password and sign in. It expires for your safety — you can always request a new one from the sign-in page.</p>
         </div>
         ${
           opts.domain
             ? `<div style="background:#ffffff;border:1px solid #dcebd5;border-radius:16px;padding:14px">
                  <div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#12854c;margin-bottom:4px">Live on</div>
                  <div style="font-size:15px;font-weight:800;color:#0f172a">${htmlEscape(opts.domain)}</div>
                </div>`
             : ""
         }
       </div>
     </div>`
  );

  const text =
    `${intro}\n\nAccess your account: ${opts.ctaUrl}\n` +
    (opts.domain ? `\nYour School Explorer is live on ${opts.domain}.\n` : "");

  await sendTransactionalEmail({ to: opts.to, subject, html, text });
}
