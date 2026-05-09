"use server";

import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthClient } from "@/lib/google-auth";
import { google } from "googleapis";
import { redirect } from "next/navigation";

export async function approveAndSync(submissionId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const classroomSubmissionId = submission.classroom_submission_id as string | null;
  if (!classroomSubmissionId) {
    throw new Error(
      "Missing Classroom submission id for this row. Re-run grading from the dashboard."
    );
  }

  const { data: tokenData } = await supabase
    .from("user_provider_tokens")
    .select("provider_refresh_token")
    .eq("user_id", submission.teacher_id as string)
    .single();

  if (!tokenData || !tokenData.provider_refresh_token) {
    await supabase.from("submissions").update({ status: "REAUTH_REQUIRED" }).eq("id", submissionId);
    redirect("/auth/error?message=Google connection lost. Please log in again.");
  }

  try {
    const authClient = await getGoogleAuthClient(tokenData.provider_refresh_token);
    const classroom = google.classroom({ version: "v1", auth: authClient });

    await classroom.courses.courseWork.studentSubmissions.patch({
      courseId: submission.course_id,
      courseWorkId: submission.assignment_id,
      id: classroomSubmissionId,
      updateMask: "draftGrade",
      requestBody: {
        draftGrade: submission.suggested_grade,
      },
    });

    await supabase.from("submissions").update({ status: "SYNCED" }).eq("id", submissionId);

    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 401 || err.code === 403) {
      await supabase.from("submissions").update({ status: "REAUTH_REQUIRED" }).eq("id", submissionId);
      redirect("/auth/error?message=Google authorization expired. Please log in again.");
    }
    throw new Error("Failed to sync to Classroom");
  }
}

/** Discard AI draft without posting to Classroom (e.g. teacher will re-grade manually). */
export async function rejectSubmissionDraft(submissionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase
    .from("submissions")
    .update({
      status: "ARCHIVED",
      feedback_draft: null,
      suggested_grade: null,
      rubric_alignment_score: null,
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);
  return { success: true };
}
