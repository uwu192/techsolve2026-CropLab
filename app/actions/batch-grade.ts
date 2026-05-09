"use server";

import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

export async function startBatchGrading(
  courseId: string,
  courseWorkId: string,
  submissions: { studentId: string; driveFileIds: string[]; classroomSubId: string }[],
  rubric: string
): Promise<{ queued: number; error?: string }> {
  console.log("[startBatchGrading] Reached", { subCount: submissions.length });
  
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
        classroom_submission_id: sub.classroomSubId,
        rubric: rubric.trim(),
        status: "PENDING",
        extracted_text: null,
        uncertain_phrases: [],
        feedback_draft: null,
        suggested_grade: null,
        rubric_alignment_score: null,
        is_uncertain: false,
        error_message: null
      };

      payload.drive_file_id = sub.driveFileIds[0];
      payload.drive_file_ids = sub.driveFileIds;

      const { data: row, error } = await supabase
        .from("submissions")
        .upsert(payload, { onConflict: "classroom_submission_id" })
        .select()
        .single();

      if (error) {
        console.error("[startBatchGrading] Supabase Error:", error.message);
        if (error.message.includes("drive_file_ids")) {
          delete payload.drive_file_ids;
          const { data: retryRow, error: retryError } = await supabase
            .from("submissions")
            .upsert(payload, { onConflict: "classroom_submission_id" })
            .select()
            .single();
          
          if (retryError) throw new Error(retryError.message);
          
          await inngest.send({
            name: "submissions/process",
            data: {
              submissionId: retryRow.id,
              driveFileIds: sub.driveFileIds,
              teacherId: user.id,
              rubric: rubric.trim(),
            },
          });
          queued++;
          continue;
        }
        throw new Error(error.message);
      }

      if (!row) continue;

      await inngest.send({
        name: "submissions/process",
        data: {
          submissionId: row.id,
          driveFileIds: sub.driveFileIds,
          teacherId: user.id,
          rubric: rubric.trim(),
        },
      });

      queued++;
    }

    return { queued };
  } catch (err: any) {
    console.error("[startBatchGrading] Error:", err.message);
    return { queued: 0, error: err.message };
  }
}
