"use server";

import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

export async function startBatchGrading(
  courseId: string,
  courseWorkId: string,
  submissions: { studentId: string; studentName: string; studentEmail: string; driveFileIds: string[]; classroomSubId: string }[],
  rubric: string
): Promise<{ queued: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    let queued = 0;

    for (const sub of submissions) {
      const payload: any = {
        teacher_id: user.id,
        course_id: courseId,
        assignment_id: courseWorkId,
        student_id: sub.studentId,
        student_name: sub.studentName,
        student_email: sub.studentEmail,
        classroom_submission_id: sub.classroomSubId,
        rubric: rubric.trim(),
        status: "PENDING",
        extracted_text: null,
        uncertain_phrases: [],
        feedback_draft: null,
        suggested_grade: null,
        rubric_alignment_score: null,
        is_uncertain: false,
        error_message: null,
        drive_file_id: sub.driveFileIds[0],
        drive_file_ids: sub.driveFileIds
      };

      const { data: row, error } = await supabase
        .from("submissions")
        .upsert(payload, { onConflict: "classroom_submission_id" })
        .select()
        .single();

      if (error) {
        // Fallback for missing columns
        delete payload.student_name;
        delete payload.student_email;
        delete payload.drive_file_ids;
        await supabase.from("submissions").upsert(payload, { onConflict: "classroom_submission_id" });
      }

      const submissionId = row?.id || (await supabase.from("submissions").select("id").eq("classroom_submission_id", sub.classroomSubId).single()).data?.id;

      if (submissionId) {
        await inngest.send({
          name: "submissions/process",
          data: { submissionId, driveFileIds: sub.driveFileIds, teacherId: user.id, rubric: rubric.trim() },
        });
        queued++;
      }
    }

    return { queued };
  } catch (err: any) {
    return { queued: 0, error: err.message };
  }
}
