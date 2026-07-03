// Optional Cloudflare Turnstile (free bot protection) for auth endpoints.
//
// Enabled only when TURNSTILE_SECRET_KEY is set (and the client renders the
// widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set). When unset, verification
// is a no-op so login/signup keep working unchanged.

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Hard-require a valid token only when TURNSTILE_ENFORCE=1. Otherwise we still
// validate any token that IS supplied, but won't lock users out if the widget
// fails to load/solve (e.g., hostname/config issues) — a safe staged rollout.
export function turnstileEnforced(): boolean {
  return process.env.TURNSTILE_ENFORCE === "1";
}

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → allow
  if (!token) return !turnstileEnforced(); // no token → allow unless enforcing
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
