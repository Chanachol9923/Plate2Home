/** Product-level constants. Retention values are LEGAL-TODO(retention); see docs/legal-todo.md. */

/** Recorded with every post. Bump when the consent text changes. LEGAL-TODO(consent) */
export const CONSENT_VERSION = '2026-09-v1';

/** Posts expire after this many days (mirrors the posts.expires_at default). */
export const POST_TTL_DAYS = 60;

export const MAX_PLATES_PER_BATCH = 20;

/** How long a found batch accepts plate uploads after it was created. */
export const UPLOAD_TOKEN_TTL_SECONDS = 30 * 60;

/** Signed crop image URLs expire quickly: they're only needed while the page is open. */
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export const SEARCH_RESULT_LIMIT = 20;

/** Largest crop upload accepted before processing (the client sends ~150 KB WebP). */
export const MAX_CROP_UPLOAD_BYTES = 1.5 * 1024 * 1024;

/** Largest JSON body accepted by any API route. */
export const MAX_JSON_BYTES = 16 * 1024;
