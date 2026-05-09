# Architecture Decisions & Patterns

## Core Stack
- **Framework**: Next.js 16 with App Router (Turbopack)
- **UI**: shadcn/ui components + Tailwind CSS + Radix UI
- **Backend**: Vercel AI SDK for structured LLM outputs via Zod
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Auth**: Supabase SSR + Google OAuth 2.0
- **Background Jobs**: Inngest (event-driven + scheduled tasks)
- **AI Models**: Gemini 2.5 Flash (vision + structured extraction)
- **Real-time UI**: React 19 + next/navigation for client-side state

## Design Patterns

### 1. Server Actions for Mutations
All database mutations and Google API calls flow through Server Actions in `app/actions/`:
- **auth.ts**: Google OAuth sign-in
- **classroom.ts**: Fetch courses, assignments, submissions from Classroom API
- **batch-grade.ts**: Initiate batch grading pipeline
- **submissions.ts**: Approve/sync grade to Classroom, reject draft
- **delete-submissions.ts**: Bulk delete submissions (teacher-only)
- **mock-inject.ts**: Development utility to test pipelines with real Drive files

### 2. Inngest for AI Pipeline
Complex, long-running operations are offloaded to Inngest:
- **processSubmissionPipeline**: Two-stage AI chain (Extractor → Grader) with structured outputs
- **resubmissionPoller**: Every 2 minutes, detect student re-uploads and re-queue pipeline
- **submissionJanitor**: Daily cleanup of terminal submissions (>7 days old)

### 3. Refresh Token Handling
Google OAuth tokens expire in ~1 hour. Instead of forcing re-auth:
- Store refresh token in `user_provider_tokens` table at login
- Use `refreshGoogleAccessToken()` in background jobs (Inngest) and API routes
- If token is revoked (400/401), gracefully set submission status to `REAUTH_REQUIRED`

### 4. Strict Validation with Zod
All AI outputs and form inputs validated with Zod schemas:
- **ExtractorSchema**: `{ transcript: string, uncertain_phrases: string[], is_uncertain: boolean }`
- **GraderSchema**: `{ suggested_grade: number, feedback_draft: string, rubric_alignment_score: number }`
- Server Action inputs validated before processing

### 5. Row-Level Security (RLS)
Teachers see only their own submissions + submissions shared by collaborators:
```sql
CREATE POLICY "Teachers and collaborators can view submissions"
  ON submissions FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM teacher_collaborators c
      WHERE c.owner_teacher_id = submissions.teacher_id
        AND c.collaborator_user_id = auth.uid()
    )
  );
```

### 6. Split-Screen Review Canvas
Interactive UI for reviewing AI-generated grades:
- Left: Resizable image panel showing submission
- Right: Transcription + AI feedback + suggested grade
- Uncertain phrases highlighted in yellow for manual review
- Teacher can approve (sync to Classroom) or reject (archive without posting)

### 7. Multi-stage Submission Status
Tracking submission state prevents race conditions and enables clear UX feedback:
- PENDING: Queued, awaiting processing
- PROCESSING: Inngest pipeline running
- DRAFT_READY: AI complete, awaiting teacher review
- SYNCED: Grade posted to Classroom
- ARCHIVED: Teacher rejected, or cleanup purged
- REAUTH_REQUIRED: Google token expired/revoked
- FAILED: Pipeline error (Inngest retried and gave up)

## Security Highlights
- **No client-side tokens**: OAuth refresh tokens never sent to browser
- **Proxy API routes**: `/api/drive-file/[fileId]` shields token from client
- **Service Role Key**: Used only in Inngest workers (never exposed to client)
- **Scoped OAuth**: Only request Classroom read/write + Drive read + email scopes
- **Ephemeral AI access**: Google access tokens live ~1 hour, refreshed on-demand

## Deployment Ready
- ✅ Environment variables (Supabase, Google, Inngest) via `.env.local`
- ✅ Vercel deployment tested
- ✅ RLS policies prevent data leaks between teachers
- ✅ Graceful error handling (token revocation, network faults, quota limits)
- ✅ No hardcoded secrets in codebase
