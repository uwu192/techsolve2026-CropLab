-- Migration: Add multi-file support to submissions table
-- 1. Add new column for multiple file IDs
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS drive_file_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Add GIN index for efficient array searching
CREATE INDEX IF NOT EXISTS submissions_drive_file_ids_gin_idx ON public.submissions USING GIN (drive_file_ids);

-- 3. Add constraint to ensure at least one file exists
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_drive_file_ids_check CHECK (cardinality(drive_file_ids) > 0);

-- 4. Data Migration: Copy existing drive_file_id to drive_file_ids array
UPDATE public.submissions
SET drive_file_ids = ARRAY[drive_file_id]
WHERE drive_file_id IS NOT NULL 
  AND (drive_file_ids IS NULL OR cardinality(drive_file_ids) = 0);

-- 5. Comment for documentation
COMMENT ON COLUMN public.submissions.drive_file_ids IS 'Array of Google Drive file IDs for this submission (supports multi-page work).';