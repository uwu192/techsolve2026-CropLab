# Teacher Assistant AI

AI-powered grading assistant for Google Classroom. Automatically extract handwritten student submissions, generate detailed feedback, and sync grades back to Classroom.

## Features

✨ **AI-Powered Handwriting Recognition**
- Uses Gemini 2.5 Flash to extract text from handwritten images
- Flags uncertain phrases for teacher review
- Handles PDFs, images, and Google Docs

🎓 **Intelligent Grading**
- Two-stage AI pipeline: extract → grade
- Teacher-defined rubrics for custom grading criteria
- Provides detailed markdown feedback with confidence scores

📚 **Google Classroom Integration**
- Fetch all courses and assignments
- Download student submissions from Drive
- Post draft grades directly to Classroom
- Automatic resubmission detection (checks every 2 minutes)

👥 **Multi-Teacher Collaboration**
- Share submissions with co-teachers/TAs via RLS policies
- Each teacher owns their submissions
- Collaborators can view and review shared work

🔄 **Background Job Pipeline**
- Inngest orchestrates extraction → grading workflow
- Automatic retry on transient failures
- Daily cleanup of archived submissions
- Graceful handling of token expiration

## Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud account (OAuth + Gemini API)
- Supabase project
- Inngest account (free tier available)

### Setup

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd multiagent-ai
   npm install
   ```

2. **Configure environment** (`.env.local`)
   ```
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Google OAuth (Cloud Console → APIs & Services → Credentials)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...

   # Gemini API Key (Google AI Studio or Vertex)
   GOOGLE_GENERATIVE_AI_API_KEY=...

   # Inngest (optional for local dev)
   INNGEST_EVENT_KEY=local
   INNGEST_BASE_URL=http://localhost:8288
   ```

3. **Run migrations** (Supabase CLI)
   ```bash
   supabase migration list  # verify migrations exist
   # Migrations auto-apply in development
   ```

4. **Start local dev**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

5. **Start Inngest (if testing background jobs)**
   ```bash
   npx inngest-cli@latest dev
   # In another terminal: npm run dev
   ```

## Project Structure

```
app/
  page.tsx                 # Home / Google OAuth login
  layout.tsx              # Root layout with theme provider
  actions/                # Server actions (mutations)
    auth.ts              # Google OAuth sign-in
    classroom.ts         # Fetch courses, assignments, submissions
    batch-grade.ts       # Initiate grading pipeline
    submissions.ts       # Approve/sync, reject draft
    delete-submissions.ts # Bulk delete
    mock-inject.ts       # Dev utility
  api/
    drive-file/[fileId]/ # Proxy to stream Drive files securely
    inngest/             # Inngest webhook
  protected/
    page.tsx             # Dashboard (submissions list)
    review/[id]/page.tsx # Review canvas for single submission
  auth/
    callback/route.ts    # OAuth callback handler
    confirm/route.ts     # Email OTP confirmation (if enabled)
    error/page.tsx       # Error display

components/
  dashboard-client.tsx   # Dashboard UI (course → assignment → grade)
  review-canvas.tsx      # Split-screen review interface
  auth-button.tsx        # Login/logout button
  logout-button.tsx      # Sign out handler
  ui/                    # shadcn/ui components (button, table, card, etc.)

lib/
  supabase/
    server.ts            # Supabase SSR client
  google-auth.ts         # OAuth client setup
  google-token.ts        # Token refresh logic
  schemas/
    ai-schemas.ts        # Zod schemas for AI outputs
  utils.ts               # Utility functions

inngest/
  client.ts              # Inngest client
  functions.ts           # Register all functions
  process-submission.ts  # Extractor → Grader pipeline
  resubmission-poller.ts # Check for student re-uploads (2min cron)
  janitor.ts             # Clean old submissions (1day cron)

supabase/
  migrations/
    20260509152033_init_schema.sql          # Tables + enums + RLS
    20260509182500_add_rubric_and_classroom_id.sql
    20260510120000_pipeline_rls_and_columns.sql  # Collaborators + metadata

docs/
  tech-spec.md           # Data models, APIs, state machine
  architect.md           # Design patterns, security, deployment
  changelog/pending.md   # Release notes and cleanup log
```

## Workflow

### Teacher Perspective

1. **Sign in** with Google (Classroom + Drive + email scopes)
2. **Dashboard** shows list of submitted grading tasks
3. **Scan Classroom** to select a course and assignment
4. **Set rubric** (e.g., "10 pts for correct answer, 5 pts for reasoning")
5. **Grade All** queues submissions for AI processing
6. **Review Canvas** shows extracted text + AI feedback
7. **Approve & Sync** posts draft grade to Classroom, or **Reject** to skip

### Behind the Scenes

1. **Batch Grade** creates `submissions` rows (PENDING status)
2. **Inngest pipeline** triggered per submission:
   - Extract Agent: calls Gemini vision to transcribe + flag uncertain words
   - Grader Agent: calls Gemini to evaluate transcript against rubric
3. Status updated to DRAFT_READY
4. Teacher reviews in **Review Canvas**
5. On approval: Classroom API updates draftGrade, status → SYNCED
6. **Resubmission Poller** detects new uploads, resets to PENDING, re-queues

## Authentication & Security

- **Google OAuth 2.0**: Classroom, Drive, email scopes with offline access
- **Refresh Token Storage**: Securely persisted in `user_provider_tokens` table
- **Server-only Tokens**: Never exposed to browser; API routes/jobs refresh on-demand
- **Row-Level Security**: RLS policies ensure teachers see only their data
- **Collaborator Access**: Controlled via `teacher_collaborators` table

## Deployment

### Vercel

```bash
# One-click deploy:
# 1. Push to GitHub
# 2. Connect repo to Vercel
# 3. Add environment variables (Supabase, Google, Inngest keys)
# 4. Deploy
```

### Self-Hosted

```bash
npm run build
npm run start
# Ensure environment variables set and Inngest worker running
```

## Development

### Scripts

```bash
npm run dev      # Start Next.js dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Testing

- Use **Mock Injection** (`app/actions/mock-inject.ts`) to test pipeline with real Drive files
- Check Inngest dashboard for job logs
- Review Supabase logs for RLS policy violations

### Database

- Supabase PostgreSQL with migrations in `supabase/migrations/`
- Migrations auto-apply in dev; use CLI for production

## Troubleshooting

**"Google connection lost"** → Teacher's OAuth token expired. Sign out and back in.

**"Missing Classroom submission id"** → Submission row lacks `classroom_submission_id`. Re-run grading.

**Inngest jobs not running** → Ensure `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` set, or start local dev server (`npx inngest-cli dev`).

**Build fails** → Check `npm run lint` and `npm run build` output for TypeScript errors.

## License

MIT (open for academic/commercial use)

## Clone and run locally

1. You'll first need a Supabase project which can be made [via the Supabase dashboard](https://database.new)

2. Create a Next.js app using the Supabase Starter template npx command

   ```bash
   npx create-next-app --example with-supabase with-supabase-app
   ```

   ```bash
   yarn create next-app --example with-supabase with-supabase-app
   ```

   ```bash
   pnpm create next-app --example with-supabase with-supabase-app
   ```

3. Use `cd` to change into the app's directory

   ```bash
   cd with-supabase-app
   ```

4. Rename `.env.example` to `.env.local` and update the following:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[INSERT SUPABASE PROJECT API PUBLISHABLE OR ANON KEY]
  ```
  > [!NOTE]
  > This example uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which refers to Supabase's new **publishable** key format.
  > Both legacy **anon** keys and new **publishable** keys can be used with this variable name during the transition period. Supabase's dashboard may show `NEXT_PUBLIC_SUPABASE_ANON_KEY`; its value can be used in this example.
  > See the [full announcement](https://github.com/orgs/supabase/discussions/29260) for more information.

  Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The starter kit should now be running on [localhost:3000](http://localhost:3000/).

6. This template comes with the default shadcn/ui style initialized. If you instead want other ui.shadcn styles, delete `components.json` and [re-install shadcn/ui](https://ui.shadcn.com/docs/installation/next)

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

## Feedback and issues

Please file feedback and issues over on the [Supabase GitHub org](https://github.com/supabase/supabase/issues/new/choose).

## More Supabase examples

- [Next.js Subscription Payments Starter](https://github.com/vercel/nextjs-subscription-payments)
- [Cookie-based Auth and the Next.js 13 App Router (free course)](https://youtube.com/playlist?list=PL5S4mPUpp4OtMhpnp93EFSo42iQ40XjbF)
- [Supabase Auth and the Next.js App Router](https://github.com/supabase/supabase/tree/master/examples/auth/nextjs)
