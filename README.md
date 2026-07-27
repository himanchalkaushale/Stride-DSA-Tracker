# Stride — Personal DSA Progress Tracker

Stride is a focused, cloud-synced workspace for building a consistent data structures and algorithms practice habit. This repository is delivered in four phases; Phase 1 establishes the secure application foundation.

## Phase 1 features

- Responsive Next.js 16 application shell
- Supabase email magic-link and Google OAuth authentication
- Protected routes and first-run onboarding
- PostgreSQL schema for profiles, problems, personal progress, daily tasks, attempts, and solution revisions
- Row-level security for complete per-user isolation
- Typed Supabase clients and repository boundary
- Original 24-problem topic-mastery starter roadmap
- Loading, authentication, configuration, and application error states

Later phases add the full problem workflow, code editor, adaptive planner, reviews, and analytics. Read [PHASE_HANDOFF.md](./PHASE_HANDOFF.md) before beginning the next phase.

## Local setup

### 1. Install dependencies

```bash
npm install
```

Node.js 20.9 or newer is recommended.

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then open its SQL editor and run:

```text
supabase/migrations/0001_phase_one.sql
```

The migration is safe to run against a new project. It creates the schema, indexes, triggers, RLS policies, and curated roadmap.

### 3. Configure authentication

In Supabase Authentication → URL Configuration:

- Set the local site URL to `http://localhost:3000`.
- Add `http://localhost:3000/auth/callback` as a redirect URL.
- Add the production `/auth/callback` URL before deployment.

Email magic links work after email authentication is enabled. For Google login, enable the Google provider and add the client ID and secret supplied by Google Cloud.

### 4. Configure environment variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Only use the Supabase anonymous key in `NEXT_PUBLIC_*`. Never expose a service-role key to the browser.

### 5. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`, create an account, and complete onboarding.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

For local RLS verification, follow the commented test procedure in `supabase/tests/rls_isolation.sql` with two test-user UUIDs.

## Security model

- Curated problems have no owner and are readable by every authenticated user.
- Custom problems require `owner_id = auth.uid()` and cannot be converted into curated problems from the client.
- Profiles, progress, daily tasks, attempts, and solution revisions can only be accessed when `user_id = auth.uid()`.
- Authentication is validated with `supabase.auth.getUser()` on protected server routes.
- Session cookies are refreshed through the Next.js proxy.

## Project structure

```text
src/app/                 Routes, authentication, onboarding, and app views
src/components/          Shared shell and visual components
src/lib/supabase/        Browser, server, and proxy Supabase clients
src/lib/repository/      Typed persistence boundary
src/types/               Database and domain types
supabase/migrations/     Versioned database schema
supabase/tests/          RLS verification scripts
```
