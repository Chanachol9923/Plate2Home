// Print the local Supabase URL and keys (from `supabase status -o json` on stdin) as
// KEY=value lines for $GITHUB_ENV. Handles both new (publishable/secret) and legacy key names.
import { readFileSync } from 'node:fs';

const status = JSON.parse(readFileSync(0, 'utf8'));
const pick = (...names) => names.map((n) => status[n]).find(Boolean);

const env = {
  NEXT_PUBLIC_SUPABASE_URL: pick('API_URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick('PUBLISHABLE_KEY', 'ANON_KEY'),
  SUPABASE_SECRET_KEY: pick('SECRET_KEY', 'SERVICE_ROLE_KEY'),
};
for (const [key, value] of Object.entries(env)) {
  if (!value) {
    console.error(`supabase status did not report a value for ${key}`);
    process.exit(1);
  }
  console.log(`${key}=${value}`);
}
