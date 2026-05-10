# 💀 Project Skeleton: Teacher Assistant AI (Multi-Agent Grading)

This document contains the complete architectural blueprint and technical specifications for the Teacher Assistant AI pipeline.

## 🚀 Core Technology Stack
- **Framework**: Next.js (App Router)
- **Runtime**: Inngest (Durable Execution & AI Orchestration)
- **Database**: Supabase (PostgreSQL + RLS)
- **AI Engine**: Vercel AI SDK + Google Gemini 3.0 Flash (Experimental)
- **Integrations**: Google Classroom API (OAuth2), Google Drive API (V3)

---

## 🧠 AI Pipeline Architecture (The "Consensus Committee")
The pipeline is optimized for **Vietnamese Handwriting Extraction** and **High-Fidelity Grading**.

### Phase 1: High-Performance Consensus (Parallel)
- **Reader Primary**: Literal transcription. Temperature: 0. Grounded in vision.
- **Reader Skeptical**: Critical transcription. Looks for messy handwriting and flags uncertainty.
- **Interleaving Strategy**: Pages are fed to the AI as `[Text Label] -> [Image/PDF Data]`. This prevents context-drift in multi-page documents.

### Phase 2: Expert Panel Consolidation (Sequential)
To optimize runtime, we consolidate three agents into one "Expert Panel" call:
- **Reconciliation**: Compares transcripts from Reader A/B and kills hallucinations.
- **Grading**: Applies the Rubric to the verified transcript.
- **Refining**: Polishes feedback for tone, fairness, and rubric alignment.
*This consolidation saves ~20 seconds per submission compared to sequential agent calls.*

---

## 📊 Database Schema (Supabase)

### Table: `submissions`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `teacher_id` | UUID | FK to Auth |
| `course_id` | TEXT | Google Classroom Course ID |
| `assignment_id` | TEXT | Google Classroom Assignment ID |
| `student_id` | TEXT | Student User ID |
| `classroom_submission_id`| TEXT | UNIQUE - Used for Upsert/Idempotency |
| `status` | TEXT | PENDING, PROCESSING, DRAFT_READY, SYNCED, FAILED |
| `drive_file_ids` | TEXT[] | Array of attached files (Multi-page support) |
| `drive_file_id` | TEXT | Fallback for legacy single-file logic |
| `extracted_text` | TEXT | The final reconciled transcript |
| `feedback_draft` | TEXT | Markdown feedback for student |
| `suggested_grade` | NUMERIC | The AI-calculated score |
| `is_uncertain` | BOOLEAN | True if handwriting was flagged by skeptics |
| `error_message` | TEXT | Captures AI or Pipeline failures |

---

## 🛠️ Environment Variables (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`: DB URL
- `SUPABASE_SERVICE_ROLE_KEY`: Admin key for Inngest updates
- `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API Key (Currently Gemini 3 Flash)
- `TOGETHER_API_KEY`: Open-source fallback (Qwen2-VL)
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`: Inngest Auth

---

## 📁 Key File Map

### ⚡ Server Actions (`app/actions/`)
- `classroom.ts`: Fetches courses, assignments, and student submissions/roster.
- `batch-grade.ts`: Orchestrates the database upsert and triggers the Inngest events.
- `submissions.ts`: Handles manual approval and syncing back to Google Classroom.

### 🌊 Inngest Pipeline (`inngest/`)
- `process-submission.ts`: The "Core Brain." Contains the 5-agent consensus logic.
- `resubmission-poller.ts`: Background worker that checks for updated student files.

### 🎨 Components
- `dashboard-client.tsx`: The main Teacher Hub. Handles scanning and batch-grading.
- `review-canvas.tsx`: Side-by-side review interface with transcript highlighting.

---

## 🔄 Lifecycle of a Grade
1. **Scan**: Teacher clicks "Scan" -> Classroom API returns student list.
2. **Batch Grade**: Teacher enters rubric -> `startBatchGrading` creates DB rows & sends Inngest event.
3. **Inngest Pipeline**:
    - Refresh Google Tokens.
    - Fetch raw bytes from Drive inside the step (to avoid 4MB payload limits).
    - Run Dual-Reader Consensus.
    - Run Expert Panel Grading.
    - Update DB to `DRAFT_READY`.
4. **Review**: Teacher reviews AI work in the "Review Canvas."
5. **Sync**: Teacher clicks "Approve" -> Grade is pushed to Google Classroom via API.
