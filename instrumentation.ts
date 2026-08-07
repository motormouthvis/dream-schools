// Runs once per server process on boot.
//
// Empty since the Dream Neighborhood usage push was retired: DN counts views on
// its own resolve endpoint now, which it is called on once per visitor per
// minute, so reporting our count as well would have double-counted every view.

export async function register(): Promise<void> {
  // Nothing to start.
}
