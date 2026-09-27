# Security checklist

Each item says **how it is verified**. ✅ = verified by an automated test or check run in CI,
☑️ = verified manually (date), ⏳ = later phase.

## Database

- ✅ RLS enabled on every table in `public`. _(rls.test.ts: "has RLS enabled on every table")_
- ✅ `anon` has zero table privileges. _(rls.test.ts)_
- ✅ `anon` can't select or insert on any table, or call any RPC. _(rls.test.ts)_
- ✅ Non-admin `authenticated` can't read server-only tables and sees zero rows elsewhere. _(rls.test.ts)_
- ✅ An admin at AAL1 is rejected; an admin at AAL2 is limited to whitelisted columns and tables. _(rls.test.ts)_
- ✅ Admins can't read contacts, credentials, push endpoints, rate limits or the access log. _(rls.test.ts)_
- ✅ Every `SECURITY DEFINER` function pins `search_path=''`. _(rls.test.ts)_
- ✅ The audit log is append-only, even for the owner and service_role. _(rls.test.ts)_
- ✅ The `crops` bucket is private and WebP-only. _(rls.test.ts)_
- ✅ Deleting a post really deletes contacts, push subscriptions, PIN state and matches, and queues the crop for Storage deletion. _(schema.test.ts)_
- ✅ Integrity: a post's kind matches its batch; match sides can't be swapped; at least one visible contact; argon2id-only PIN hashes. _(schema.test.ts)_
- ⏳ CI runs all of the above against a real `supabase start` database (workflow written; pending the first push to GitHub). Locally verified on PGlite only.
- ⏳ `supabase db lint` clean _(runs in CI; first result pending the first push)_.

## Secrets

- ✅ The Supabase secret key is only used in `lib/db/server.ts` (`import 'server-only'`).
- ✅ ESLint forbids importing `lib/db/server` outside `lib/db/**`.
- ✅ ESLint forbids non-`NEXT_PUBLIC_` env access in `'use client'` files. _(rule + RuleTester tests)_
- ✅ CI builds with canary secrets and scans client bundles and prerendered payloads. _(ci.yml "build" job; scanner unit-tested)_
- ✅ `.env*` is git-ignored except `.env.example`.
- ☑️ Local production build scanned: no secrets in 26 client files (2026-09-27).

## HTTP

- ✅ Nonce-based CSP; no `'unsafe-inline'`/`'unsafe-eval'` for scripts in production; `frame-ancestors 'none'`; `object-src 'none'`. _(csp.test.ts)_
- ☑️ Production server: CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options present; `X-Powered-By` absent; no CSP violations in the console; pre-paint theme script carries the nonce (2026-09-27).
- ⏳ Origin header check on every non-GET API route (Phase 3).
- ⏳ Turnstile server-side verification with action/hostname checks (Phase 3).

## Auth (admin)

- ✅ Local config: sign-ups disabled, TOTP enroll/verify on, 12-character passwords with all character classes, 8 h timebox / 1 h inactivity. _(supabase/config.toml)_
- ⏳ Mirror these settings in the hosted project (runbook, Phase 9).
- ⏳ AAL2 enforced in proxy and in every admin action (Phase 7).

## Supply chain

- ✅ Lockfile committed; exact versions pinned.
- ✅ `npm audit --omit=dev --audit-level=high` in CI.
- ✅ GitHub Actions pinned to commit SHAs; Dependabot for npm and Actions.

## Later phases

- ⏳ zod on every input; free-text anti-scam sanitization (Phase 3)
- ⏳ sharp re-encode and validation of uploads (Phase 3)
- ⏳ PIN argon2id, lockout and backoff (Phase 4)
- ⏳ IP hashing with rotating salt (Phase 4)
- ⏳ Signed URLs ≤ 5 minutes (Phase 3)
- ⏳ No PII in logs (logger, Phase 3)
