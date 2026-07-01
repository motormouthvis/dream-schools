// Provider-agnostic transactional email. Configure whichever provider you
// already pay for via env vars — no code change needed:
//
//   • RESEND_API_KEY               → Resend (HTTP API, no SMTP setup)
//   • SMTP_HOST / SMTP_PORT /
//     SMTP_USER / SMTP_PASS        → any SMTP provider (SendGrid, SES, Postmark,
//                                    Mailgun, …) via their SMTP credentials
//   • (none configured)            → the link is logged to the server console so
//                                    the flow still works in dev.
//
// From address: EMAIL_FROM (default noreply@dreamneighborhoodschools.com).

const FROM =
  process.env.EMAIL_FROM || "Dream Neighborhood Schools <noreply@dreamneighborhoodschools.com>";

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendViaResend(mail: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) console.error("Resend send failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Resend error:", err);
    return false;
  }
}

async function sendViaSmtp(mail: Mail): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) return false;
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    return true;
  } catch (err) {
    console.error("SMTP error:", err);
    return false;
  }
}

async function send(mail: Mail): Promise<void> {
  if (await sendViaResend(mail)) return;
  if (await sendViaSmtp(mail)) return;
  // Dev fallback — surface the content (incl. any link) in logs.
  console.info(`[email:dev] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
}

function shell(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-weight:800;color:#12854c;font-size:16px;margin-bottom:16px">Dream Neighborhood Schools</div>
    ${bodyHtml}
    <p style="color:#94a3b8;font-size:11px;margin-top:24px">If you didn't request this, you can ignore this email.</p>
  </div>`;
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await send({
    to,
    subject: "Verify your email — Dream Neighborhood Schools",
    text: `Welcome! Confirm your email to activate your free School Explorer account:\n\n${verifyUrl}\n\nThis link expires in 48 hours.`,
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 8px">Confirm your email</h1>
       <p style="color:#475569;font-size:14px;margin:0 0 20px">You're one click away from your free School Explorer account.</p>
       <a href="${verifyUrl}" style="display:inline-block;background:#12854c;color:#fff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px">Verify email →</a>
       <p style="color:#94a3b8;font-size:12px;margin-top:16px">Or paste this link: <br>${verifyUrl}</p>
       <p style="color:#94a3b8;font-size:12px">This link expires in 48 hours.</p>`
    ),
  });
}
