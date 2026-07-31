// Runs once per server process on boot. Used only to start the Dream
// Neighborhood push timer, which is itself a no-op unless DN_INGEST_API_KEY is
// set — see lib/dnIngest.ts for why the web process schedules it rather than a
// Heroku Scheduler job.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDnIngestTimer } = await import("@/lib/dnIngest");
  startDnIngestTimer();
}
