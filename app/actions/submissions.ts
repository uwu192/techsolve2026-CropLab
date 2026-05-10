"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** 
 * Simply marks the submission as SYNCED (interpreted as "Done/Approved") 
 * without actually talking to Google Classroom.
 */
export async function approveAndSync(submissionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  await supabase
    .from("submissions")
    .update({ status: "SYNCED" })
    .eq("id", submissionId);

  revalidatePath("/protected");
  return { success: true };
}

/** Discard AI draft. */
export async function rejectSubmissionDraft(submissionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  await supabase
    .from("submissions")
    .update({
      status: "ARCHIVED",
      feedback_draft: null,
      suggested_grade: null,
    })
    .eq("id", submissionId);

  revalidatePath("/protected");
  return { success: true };
}
