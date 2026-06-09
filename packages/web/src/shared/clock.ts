/**
 * Pure on-site clock math. Lives in `shared/` (no DB / service imports) so it is
 * unit-testable in isolation and can be reused by both the API and the client
 * without dragging in the database connection.
 */

export interface ClockState {
  accumulatedMs: number;
  clockState: string;
  lastResumeAt: Date | string | null;
}

/**
 * Total on-site minutes for a booking: banked (`accumulatedMs`) plus the
 * currently-running segment when the clock is live.
 */
export function liveOnSiteMinutes(b: ClockState): number {
  let ms = b.accumulatedMs ?? 0;
  if (b.clockState === "running" && b.lastResumeAt) {
    ms += Date.now() - new Date(b.lastResumeAt).getTime();
  }
  return Math.round((ms / 60000) * 10) / 10;
}
