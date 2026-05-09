# Phase 1 Execution Review

This document logs the actions taken during Phase 1: Project Scaffolding for the Teacher Assistant AI MVP.

## 1. Node.js Installation
- Detected missing `npx`/`npm` commands.
- Automatically installed Node.js `v26.1.0` using Windows Package Manager (`winget`).
- Dynamically updated the PowerShell environment `$env:PATH` to execute subsequent npm commands.

## 2. Next.js Scaffolding
- Ran `npx create-next-app` using the official Supabase template (`-e with-supabase`).
- Bypassed the standard Next.js template to ensure Supabase SSR helpers and middleware were pre-configured.

## 3. Dependencies Installed
- Executed `npm install inngest ai @ai-sdk/google zod googleapis`.
- **Inngest**: For background job queuing and sequential agent execution.
- **Vercel AI SDK**: For extracting text and generating grading drafts.
- **Zod**: For structured LLM outputs and input validation.
- **Google APIs**: To explicitly manage and refresh the `provider_refresh_token`.

## 4. Documentation Setup
- Created the mandated `/docs/` folder structure.
- Generated `architect.md` (Core Stack and Patterns).
- Generated `tech-spec.md` (Data Models and External APIs).
- Generated `changelog/pending.md` (Tracking initial MVP setup).

## 5. UI Architecture Initialization
- Ran `npx shadcn@latest init -d` to generate `components.json`.
- Wired up Tailwind CSS and installed base dependencies (`lucide-react`, `clsx`, `tailwind-merge`).

---

# Phase 2 Execution Review

## 1. Database Schema Initialization
- Created Supabase SQL migration `20260509152033_init_schema.sql`.
- Defined `submissions` State Machine enum and table.
- Defined `user_provider_tokens` for storing offline Google credentials.
- Implemented strict Row Level Security (RLS) policies.
- Removed faulty `pg_cron` schedule to prevent S3 ghost objects.
- Built an Inngest Cron Janitor (`inngest/janitor.ts`) to safely purge files using the Supabase Storage API before deleting the database rows.

## 2. Robust OAuth Integration
- Implemented `app/actions/auth.ts` with Google OAuth routing, explicitly requesting `prompt: 'consent'` and `access_type: 'offline'`.
- Created `app/auth/callback/route.ts` to exchange the OAuth code, securely parse the `provider_refresh_token` from the Supabase session, and upsert it into the database.

---

# Phase 3 Execution Review

## 1. Core Utilities & Auth
- Created `lib/google-auth.ts` to implement Token Revivification using `googleapis`.
- Updated OAuth scopes in `app/actions/auth.ts` to include `classroom.coursework.students` and `classroom.profile.emails`.

## 2. AI Pipeline & Schemas
- Defined `lib/schemas/ai-schemas.ts` enforcing `uncertain_phrases` (Verbatim matches only) instead of complex bounding box coordinates.
- Built `inngest/process-submission.ts` executing a sequential two-agent pipeline:
  - **Extractor Agent**: Converts the image to a transcript and flags uncertain words.
  - **Grader Agent**: Evaluates the transcript against the rubric, injecting the uncertain phrases into its prompt to provide the student with "the benefit of the doubt."

## 3. The Interactive Canvas UI
- Added `react-resizable-panels` via `shadcn` for an expandable "Split View" workspace.
- Built `components/review-canvas.tsx` that visually renders the image on the left, and the Markdown on the right.
- Created a Regex highlighting system to overlay `<mark>` tags on the extracted text based on the AI's `uncertain_phrases`.

## 4. Approve & Sync Action
- Built the final `approveAndSync` Server Action.
- Revives the teacher's Google OAuth refresh token securely from the database.
- Gracefully handles revoked tokens by falling back to a `REAUTH_REQUIRED` database state.


## Phase 3 Execution Review

### 1. AI Pipeline & Schemas
- Created lib/schemas/ai-schemas.ts defining strict Zod schemas (ExtractorSchema, GraderSchema).
- Designed ExtractorSchema to output uncertain_phrases ensuring verbatim substring highlighting.
- Created inngest/process-submission.ts executing the Extractor -> Grader pipeline.

### 2. Google OAuth & Sync Action
- Updated pp/actions/auth.ts to include Google Classroom read/write scopes.
- Created lib/google-auth.ts to implement Token Revivification.
- Implemented pp/actions/submissions.ts with pproveAndSync Action handling 401/403 by gracefully reverting DB status to REAUTH_REQUIRED.

### 3. Review UI
- Installed eact-resizable-panels.
- Built pp/protected/review/[id]/page.tsx integrating proper Suspense loading states to satisfy Next.js prerender limits.
- Built components/review-canvas.tsx split-screen UI with <mark>-based verbatim phrase highlighting.

