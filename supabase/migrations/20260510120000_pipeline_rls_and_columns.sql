-- Extraction / grading metadata persisted for review UI and analytics
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS uncertain_phrases TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS rubric_alignment_score NUMERIC;

COMMENT ON COLUMN public.submissions.uncertain_phrases IS 'Phrases Gemini flagged as uncertain during handwriting extraction.';
COMMENT ON COLUMN public.submissions.rubric_alignment_score IS 'Model-reported rubric alignment (0–1) from grader step.';

-- Co-teachers / TAs: collaborators can read (and update) submissions owned by the granting teacher.
CREATE TABLE IF NOT EXISTS public.teacher_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_teacher_id, collaborator_user_id),
  CHECK (owner_teacher_id <> collaborator_user_id)
);

ALTER TABLE public.teacher_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage collaborator grants"
  ON public.teacher_collaborators FOR ALL
  USING (auth.uid() = owner_teacher_id)
  WITH CHECK (auth.uid() = owner_teacher_id);

CREATE POLICY "Collaborators can see grants they received"
  ON public.teacher_collaborators FOR SELECT
  USING (auth.uid() = collaborator_user_id);

-- Submissions: replace single-teacher policies with collaborator-aware rules
DROP POLICY IF EXISTS "Teachers can view their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teachers can insert their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teachers can update their own submissions" ON public.submissions;

CREATE POLICY "Teachers and collaborators can view submissions"
  ON public.submissions FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM public.teacher_collaborators c
      WHERE c.owner_teacher_id = submissions.teacher_id
        AND c.collaborator_user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers insert their own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers and collaborators can update visible submissions"
  ON public.submissions FOR UPDATE
  USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM public.teacher_collaborators c
      WHERE c.owner_teacher_id = submissions.teacher_id
        AND c.collaborator_user_id = auth.uid()
    )
  );

-- Provider tokens: collaborators may read the course owner token so server actions
-- can call Google APIs on shared classes (treat as high trust — grant only to co-teachers you trust).
DROP POLICY IF EXISTS "Collaborators may read owner Google tokens" ON public.user_provider_tokens;

CREATE POLICY "Collaborators may read owner Google tokens"
  ON public.user_provider_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_collaborators c
      WHERE c.owner_teacher_id = user_provider_tokens.user_id
        AND c.collaborator_user_id = auth.uid()
    )
  );
