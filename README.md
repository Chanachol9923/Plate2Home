# Plate2Home

A mobile-first web app that reunites people in Thailand with vehicle licence plates lost in
floods. People who **lost** a plate register a watch. People who **found** plates photograph
them, and the app reads the plates in the browser and matches them instantly. It is
non-commercial, has no user accounts, and deletes everything automatically.

> **Status: Phases 1–3 done** (foundation; Thai plate module; lost/found/search/match flows with manual entry). See [`docs/plan.md`](docs/plan.md) for the phase plan.

## Stack

Next.js 16 (App Router, `proxy.ts`) · TypeScript strict · Tailwind CSS 4 (custom tokens) ·
next-intl 4 (Thai default, English at `/en`) · Supabase (Postgres + RLS, Storage, Auth for
admins only) · Vitest · PGlite for database tests without Docker.

## Getting started

Requirements: Node 24, npm 11. Docker Desktop is optional; it's only needed to run the full
local Supabase stack.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 (Thai) or http://localhost:3000/en (English). Phase 1 pages don't
need a database.

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
4. Under **Authentication → Sign In / Providers**, turn off "Allow new users to sign up".
5. `npm run dev`, then try lost → found → match. `npm run test:integration` runs the API flow
   against the same project and cleans up after itself.

With Docker installed you can use a fully local stack instead: `npx supabase start` (it applies
the migrations and prints local keys).

## Checks

| Command                                  | What it does                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`                          | Everything below except the build                                                    |
| `npm run lint`                           | ESLint, including the no-hard-coded-text and no-server-env-in-client rules           |
| `npm run typecheck`                      | `next typegen` + `tsc`                                                               |
| `npm run test:unit`                      | Unit tests (plate module, matching, CSP, env, messages, lint rule, secret scanner)   |
| `npm run test:db`                        | Migrations + RLS tests. PGlite by default; set `DATABASE_URL` to use a real database |
| `npm run test:integration`               | API flow against real Supabase (needs Supabase keys in the environment/.env.local)   |
| `npx playwright test`                    | E2E in mobile viewports (needs a built app and Supabase)                             |
| `npm run check:contrast`                 | WCAG contrast of the design tokens, both themes                                      |
| `npm run check:provinces`                | Province seed migration matches `data/provinces.json`                                |
| `npm run build && npm run check:secrets` | Production build, then scan client files for secrets                                 |

## Project layout

```
app/[locale]/        localized pages (root layout)
app/global-not-found.tsx
components/          UI (site chrome, theme, icons, ui recipes)
i18n/                next-intl routing, navigation, request config
lib/                 config, env, security (CSP, headers), db (server-only)
messages/            th.json, en.json
supabase/            config, migrations, DB tests (harness + PGlite shim)
scripts/             contrast check, province seed generator, client secret scan
eslint-rules/        project ESLint rules
docs/                plan, architecture, decisions, threat model, security checklist, legal TODOs
```

## Docs

- [Plan](docs/plan.md) · [Architecture](docs/architecture.md) · [Decisions](docs/decisions.md)
- [Threat model](docs/threat-model.md) · [Security checklist](docs/security-checklist.md) ·
  [Legal TODOs](docs/legal-todo.md)

Deployment, cron, keepalive and the dormant-mode runbook come in Phase 9.
