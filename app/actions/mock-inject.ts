"use server";

import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

/**
 * Injects a mock submission using real Google Drive file IDs and teacher-defined rubric.
 */
export async function injectMockSubmission(
  driveFileIds: string[],
  rubric: string
): Promise<{ submissionId: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (!driveFileIds || driveFileIds.length === 0) throw new Error("At least one Drive file ID is required");
  if (!rubric?.trim()) throw new Error("Rubric / grading criteria is required");

  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      teacher_id: user.id,
      course_id: "mock-course-001",
      assignment_id: "mock-assignment-001",
      student_id: "mock-student-001",
      drive_file_ids: driveFileIds,
      status: "PENDING",
    })
    .select()
    .single();

  if (error || !submission)
    throw new Error("Failed to create mock submission: " + error?.message);

  await inngest.send({
    name: "submissions/process",
    data: {
      submissionId: submission.id,
      driveFileIds,
      teacherId: user.id,
      rubric: rubric.trim(),
    },
  });

  return { submissionId: submission.id };
}
