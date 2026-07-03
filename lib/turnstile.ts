// Optional Cloudflare Turnstile (free bot protection) for auth endpoints.
//
// Enabled only when TURNSTILE_SECRET_KEY is set (and the client renders the
// widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set). When unset, verification
// is a no-op so login/signup keep working unchanged.

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // opt-in: not configured → allow
  if (!token) return false;
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const json = await res.json().catch(() => ({}));
    return Boolean(json.success);
  } catch (err) {
    console.error("Turnstile verify failed:", err);
    return false;
  }
}
