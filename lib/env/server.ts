import 'server-only';
import { z } from 'zod';

/**
 * Server environment, validated once. Every variable is documented in .env.example.
 * Most are optional at boot so the app can run partially configured in development; code
 * that needs one calls `requireEnv()`, which fails loudly with the variable's name.
 */

const flag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

const secret = z.string().min(16);

const schema = z.object({
  APP_ORIGIN: z.url().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),

  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().startsWith('mailto:').or(z.url()).optional(),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),

  CRON_SECRET: secret.optional(),
  IP_HASH_SECRET: secret.optional(),

  // LEGAL-TODO(access-log): enable only after legal advice; see docs/legal-todo.md.
  ACCESS_LOG_ENABLED: flag,
  ACCESS_LOG_KEY: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/, 'must be 32 bytes, base64')
    .optional(),
  ACCESS_LOG_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  ACCESS_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(90),

  NEXT_PUBLIC_FEATURE_OCR: flag,
  FEATURE_EMAIL: flag,
  CRON_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
});

export type ServerEnv = z.infer<typeof schema>;

/** Misconfiguration. Its message holds only variable names, so it is safe to log. */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      // Report names only, never values.
      const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new ConfigError(`Invalid environment variables: ${names}`);
    }
    cached = parsed.data;
  }
  return cached;
}

type RequiredKey = {
  [K in keyof ServerEnv]-?: undefined extends ServerEnv[K] ? K : never;
}[keyof ServerEnv];

export function requireEnv<K extends RequiredKey>(key: K): NonNullable<ServerEnv[K]> {
  const value = serverEnv()[key];
  if (value === undefined || value === null || value === '') {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return value as NonNullable<ServerEnv[K]>;
}

/** Test helper: forget the cached parse so a test can change process.env. */
export function resetServerEnvForTests() {
  cached = undefined;
}
