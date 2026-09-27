/**
 * Fixed-window rate limits per IP hash (Postgres `rl_hit`). Mobile carriers put many people
 * behind one IP, so these are generous; Turnstile is the primary bot control.
 */
export const RATE_LIMITS = {
  'lost:create': { windowSeconds: 60 * 60, max: 10 },
  'found:batch': { windowSeconds: 60 * 60, max: 10 },
  'found:plate': { windowSeconds: 60 * 60, max: 80 },
  search: { windowSeconds: 10 * 60, max: 60 },
  // Contact reveals: per IP, and per post (a scraper rotating IPs still hits the post cap).
  reveal: { windowSeconds: 60 * 60, max: 20 },
  'reveal:post': { windowSeconds: 24 * 60 * 60, max: 60 },
} as const satisfies Record<string, { windowSeconds: number; max: number }>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;
