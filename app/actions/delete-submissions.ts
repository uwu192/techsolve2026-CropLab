"use server";
import { createClient } from "@/lib/supabase/server";

export async function deleteAllSubmissions(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("submissions").delete().eq("teacher_id", user.id);
  if (error) throw new Error(error.message);
}