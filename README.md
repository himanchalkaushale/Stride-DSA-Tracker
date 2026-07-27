# Stride — Personal DSA Progress Tracker

Stride is a cloud-synced workspace for building a consistent data structures and algorithms practice habit. All four product phases are complete: secure authentication, a coding workspace, adaptive daily planning, analytics, reminders, and production-ready polish.

## Features

- Responsive Next.js 16 shell with Supabase email magic-link and Google OAuth authentication
- Protected routes, onboarding, editable practice preferences, and row-level user isolation
- Searchable problem library with custom-problem CRUD, bookmarks, filters, sorting, and saved view preferences
- Language-aware CodeMirror editor, debounced cloud autosave, offline drafts, notes, complexity, attempts, confidence, and revision history
- Adaptive daily queue prioritizing overdue reviews, weak topics, unfinished work, and curated suggestions
- Spaced review scheduling, current/longest streaks, and optimistic dashboard updates
- Daily/weekly trends, 12-week heatmap, topic mastery, difficulty mix, solve time, attempt efficiency, confidence progression, and review retention
- Date/topic analytics filters and reminders for unfinished targets, overdue reviews, stalled problems, and streak risk
- Accessible focus states, reduced motion, skeletons, status messaging, toasts, confirmations, and helpful empty states

Analytics are calculated from persisted attempts, daily tasks, progress, and reviews. Mastery weights completion at 45%, successful attempts at 35%, and confidence at 20%. Review retention is the successful-attempt rate for problems assigned as reviews on the attempt date.

## Local setup

Node.js 20.9 or newer is recommended.

```bash
npm install
```

Create a Supabase project and run these files in order with the SQL editor:

```text
supabase/migrations/0001_phase_one.sql
supabase/migrations/0002_phase_three.sql
```

They create the schema, indexes, triggers, RLS policies, curated roadmap, and planner marker. Record applied migrations in the release log; never run `0002` before `0001`.

In Supabase Authentication → URL Configuration:

- Set the local site URL to `http://localhost:3000`.
- Add `http://localhost:3000/auth/callback`.
- Add the production `/auth/callback` URL before deployment.
- Enable email authentication. For Google login, enable Google and configure its client ID and secret.

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Only use the Supabase anonymous key in `NEXT_PUBLIC_*`. Never expose a service-role key to browser code.

```bash
npm run dev
```

Open `http://localhost:3000`, create an account, and finish onboarding. Cloud data reloads from Supabase on every route; browser storage holds only display preferences and unsynced offline drafts.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

The RLS verification procedure is in `supabase/tests/rls_isolation.sql`.

The browser acceptance flow in `tests/e2e/acceptance.spec.ts` covers sign-in, onboarding, daily-plan generation, custom-problem creation, code/notes persistence, attempt recording, completion, review scheduling, and dashboard/analytics updates.

```bash
npx playwright install chromium
E2E_USER_EMAIL=acceptance@example.com \
SUPABASE_SERVICE_ROLE_KEY=server-only-test-key \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
npm run test:e2e
```

Use a dedicated migrated test project and pre-created test user. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from `.env.local`. The service-role key is read only by Playwright to generate a magic link; never prefix it with `NEXT_PUBLIC_`, commit it, or expose it to application code.

## Production deployment

1. Create a production Supabase project and apply both migrations in order.
2. Set the production site URL and add `https://YOUR_DOMAIN/auth/callback` to the Supabase redirect URLs.
3. Add the following variables to a Next.js-compatible host:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PRODUCTION_ANON_KEY
   NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
   ```

4. Run all validation commands, then deploy.
5. Run the acceptance test against the production URL with a dedicated test user.
6. Confirm OAuth callbacks, magic links, RLS isolation, mobile navigation, analytics, and reminders in production.

The production application does not need a service-role key.

## Backup and export

Supabase database backups are the recovery source of truth; enable the backup/PITR level appropriate for the account. Before migrations and major releases, make a logical backup using the direct database connection:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file=stride-$(date +%Y-%m-%d).dump
```

Restore into a separate project first:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" stride-YYYY-MM-DD.dump
```

For a portable user export, export `profiles`, `user_problems`, `daily_tasks`, `attempts`, `solution_revisions`, and user-owned `problems` rows as CSV, filtering each table by the user UUID. Curated problems are recreated by migration. Test restoration quarterly and keep encrypted backups outside the production project.

## Project structure

```text
src/app/                 Routes, authentication, onboarding, and app views
src/components/          Shared shell and interactive product components
src/lib/                 Planning, analytics, Supabase, and persistence logic
src/types/               Database and domain types
supabase/migrations/     Versioned database schema
supabase/tests/          RLS verification scripts
tests/e2e/               Full browser acceptance flow
```
