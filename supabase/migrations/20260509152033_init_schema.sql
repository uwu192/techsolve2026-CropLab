-- Create an enum for our submission states
CREATE TYPE submission_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'DRAFT_READY',
  'SYNCED',
  'ARCHIVED',
  'REAUTH_REQUIRED',
  'FAILED'
);

-- Submissions Table
CREATE TABLE public.submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES auth.users(id) NOT NULL,
  course_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  status submission_status DEFAULT 'PENDING'::submission_status,
  extracted_text TEXT,
  feedback_draft TEXT,
  suggested_grade NUMERIC,
  is_uncertain BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Secure Tokens Table for Background Jobs
CREATE TABLE public.user_provider_tokens (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  provider_refresh_token TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage Bucket for Student Files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-files', 'student-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']);

-- RLS Policies
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_provider_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own submissions"
  ON public.submissions FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert their own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own submissions"
  ON public.submissions FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can insert their own provider token"
  ON public.user_provider_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own provider token"
  ON public.user_provider_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can select their own provider token"
  ON public.user_provider_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Add columns for resubmission tracking (added post-init)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS rubric TEXT,
  ADD COLUMN IF NOT EXISTS classroom_submission_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_classroom_sub_id_idx
  ON public.submissions (classroom_submission_id)
  WHERE classroom_submission_id IS NOT NULL;
