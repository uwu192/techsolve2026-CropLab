# Technical Specifications

## Overview
Teacher Assistant AI is an MVP that automates handwriting extraction and grading for Google Classroom submissions using Gemini Vision API. The project uses Next.js with Supabase auth, Inngest for background jobs, and strict RLS policies for multi-teacher collaboration.

## Architecture
- **Frontend**: Next.js App Router with shadcn/ui components and Tailwind CSS
- **Backend**: Server Actions for mutations, Inngest for async AI pipelines
- **Auth**: Google OAuth 2.0 with refresh token persistence in Supabase
- **Database**: Supabase PostgreSQL with row-level security (RLS)

## Data Models
- **submissions**: Tracks grading workflow (PENDING → PROCESSING → DRAFT_READY → SYNCED/ARCHIVED)
  - Stores extracted text, uncertain phrases, feedback draft, and suggested grades
  - Unique index on classroom_submission_id for resubmission detection
- **user_provider_tokens**: Securely stores Google OAuth refresh tokens for background job access
- **teacher_collaborators**: Enables co-teachers/TAs to view and edit shared submissions

## External APIs
- **Google Classroom API**: Fetch courses, assignments, student submissions; update draft grades
- **Google Drive API**: Download and convert student submission files (documents, PDFs, images)
- **Gemini 2.5 Flash**: Two-stage VLM pipeline
  - **Extractor**: Transcribes handwriting, flags uncertain phrases
  - **Grader**: Evaluates transcript against rubric, provides feedback

## Submission State Machine
```
PENDING → PROCESSING → DRAFT_READY → SYNCED
                            ↓
                        ARCHIVED (if rejected)
                            ↓
                      REAUTH_REQUIRED (on token expiry)
                            ↓
                          FAILED (on pipeline error)
```

## Background Jobs (Inngest)
- **submissions/process**: Two-agent pipeline for extraction and grading (event-triggered)
- **resubmission-poller**: Checks for new student uploads every 2 minutes (cron-triggered)
- **submission-db-janitor**: Cleans up terminal submissions older than 7 days daily (cron-triggered)
