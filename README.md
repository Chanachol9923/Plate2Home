# Plate2Home

**Live: https://plate2-home.vercel.app** (Thai) · [English](https://plate2-home.vercel.app/en)

A mobile-first web app that reunites people in Thailand with vehicle licence plates lost in
floods. People who **lost** a plate register a watch. People who **found** plates photograph
them; the app finds and reads the plates in the browser and matches them against the watches
instantly. It is non-commercial, posting needs no account, and data is deleted automatically.

## What works today

- **Lost, found, search and match flows** with Turnstile, rate limits and origin checks on every
  write. Lost watches never appear in search; an owner's contact is shown only to the finder of
  a matched found plate that has a photo (see the [threat model](docs/threat-model.md)).
- **Plate reading in the browser** (photos never leave the device): a plate finder suggests
  boxes on the photo, the user confirms each crop, and a small CNN trained on 150k synthetic
  plate lines (`ml/recognizer`, run in plain TypeScript) reads the number line. On a private
  set of 22 real plates, exact reads went from 3 to 16 and character accuracy from 45% to 90%;
  see [`docs/ocr-eval.md`](docs/ocr-eval.md) for the method and the known gaps.
- **Optional Google sign-in** to see and manage your posts on any device (mark returned,
  extend, delete). Without signing in, posts belong to the device that made them.
- **Reports, feedback and an admin area**, Terms of Service and Privacy Policy in Thai and
  English, and a **daily retention job** that really deletes expired data and photos.

Not done yet: push/email notifications (matches show up on the match page and in "My posts"),
automatic finding of motorcycle plates, and an evaluation on a larger set of real photos.
[`docs/plan.md`](docs/plan.md) has the original phase plan and
[`docs/decisions.md`](docs/decisions.md) records every change to it.

## Stack

Next.js 16 (App Router, `proxy.ts`) · TypeScript strict · Tailwind CSS 4 (custom tokens) ·
next-intl 4 (Thai default, English at `/en`) · Supabase (Postgres + RLS, Storage, Auth for
Google sign-in) · Tesseract.js + a custom PyTorch-trained recognizer · Vitest · PGlite for
database tests without Docker · Playwright · Vercel (Singapore, daily cron).

## Getting started

Requirements: Node 24, npm 11. Docker Desktop is optional; it's only needed to run the full
local Supabase stack.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 (Thai) or http://localhost:3000/en (English).

### Development backend: hosted Supabase dev project (no Docker needed)

1. Create a free project at https://supabase.com/dashboard in the **Southeast Asia (Singapore)**
   region. Use a separate project for development, never production.
2. Link it and apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. In the dashboard, under **Project Settings → API Keys**, copy the project URL, the
   **publishable** key and a **secret** key into `.env.local` (see `.env.example`). The secret
   key bypasses RLS: keep it out of chat, screenshots and commits.
4. For Google sign-in, set up the Google provider and the redirect URL as described in
   `.env.example`. Everything else works without it.
5. `npm run dev`, then try lost → found → match. `npm run test:integration` runs the API flow
   against the same project and cleans up after itself.

With Docker installed you can use a fully local stack instead: `npx supabase start` (it applies
the migrations and prints local keys).

## Checks

CI (`.github/workflows/ci.yml`) runs all of these on every push, the database and E2E tests
against a local Supabase.

| Command                                  | What it does                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`                          | Everything below except the build                                                    |
| `npm run lint`                           | ESLint, including the no-hard-coded-text and no-server-env-in-client rules           |
| `npm run typecheck`                      | `next typegen` + `tsc`                                                               |
| `npm run test:unit`                      | Unit tests (plate module, matching, OCR, CSP, env, messages, lint rule, secret scan) |
| `npm run test:db`                        | Migrations + RLS tests. PGlite by default; set `DATABASE_URL` to use a real database |
| `npm run test:integration`               | API flow against real Supabase (needs Supabase keys in the environment/.env.local)   |
| `npx playwright test`                    | E2E in mobile viewports (needs a built app and Supabase)                             |
| `npm run check:contrast`                 | WCAG contrast of the design tokens, both themes                                      |
| `npm run check:provinces`                | Province seed migration matches `data/provinces.json`                                |
| `npm run build && npm run check:secrets` | Production build, then scan client files for secrets                                 |

## Project layout

```
app/[locale]/        localized pages (root layout)
app/admin/           admin area (second root layout)
app/api/             route handlers: posting, search, reveal, auth, reports, cron
components/          UI (flows, plate input, OCR overlay, site chrome, theme, ui recipes)
i18n/                next-intl routing, navigation, request config
lib/                 plate module, matching, OCR, auth, config, env, security, db (server-only)
messages/            th.json, en.json
ml/recognizer/       synthetic data, training and export of the plate-text recognizer
supabase/            config, migrations, DB tests (harness + PGlite shim)
scripts/             contrast check, province seed generator, client secret scan, OCR assets
eslint-rules/        project ESLint rules
docs/                plan, architecture, decisions, threat model, OCR evaluation, legal TODOs
```

## Docs

- [Plan](docs/plan.md) · [Architecture](docs/architecture.md) · [Decisions](docs/decisions.md)
- [Threat model](docs/threat-model.md) · [Security checklist](docs/security-checklist.md) ·
  [OCR evaluation](docs/ocr-eval.md) · [Plate formats](docs/plate-formats.md) ·
  [Legal TODOs](docs/legal-todo.md)
