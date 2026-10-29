import 'server-only';
import type { RecordedMatch } from '@/lib/db/matches';

/**
 * Tell lost-plate owners about new matches. Web Push and optional email arrive in Phase 5;
 * until then matches are recorded with `notified_at` null and the owner sees them when
 * searching or on the match page.
 */
export async function notifyNewMatches(matches: RecordedMatch[]): Promise<void> {
  void matches; // TODO(phase-5): send push/email and set matches.notified_at
}
