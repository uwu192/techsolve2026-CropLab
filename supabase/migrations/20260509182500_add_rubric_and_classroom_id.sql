ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS rubric TEXT,
  ADD COLUMN IF NOT EXISTS classroom_submission_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_classroom_sub_id_idx
  ON public.submissions (classroom_submission_id)
  WHERE classroom_submission_id IS NOT NULL;