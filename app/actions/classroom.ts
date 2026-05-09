"use server";

import { createClient } from "@/lib/supabase/server";
import { refreshGoogleAccessToken } from "@/lib/google-token";

async function getAccessToken(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("user_provider_tokens")
    .select("provider_refresh_token")
    .eq("user_id", userId)
    .single();

  if (dbError || !data) throw new Error("No Google token found. Please re-authenticate.");

  try {
    return await refreshGoogleAccessToken(data.provider_refresh_token);
  } catch (err) {
    throw new Error("Failed to refresh Google token — please re-authenticate.");
  }
}

export type Course = { id: string; name: string; section?: string };
export type CourseWork = { id: string; title: string; state: string };
export type StudentSubmission = {
  submissionId: string;
  studentId: string;
  state: string;
  driveFiles: { id: string; name: string }[];
};

export async function getClassroomCourses(): Promise<Course[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const at = await getAccessToken(user.id);
  const res = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&teacherId=me&pageSize=50", { headers: { Authorization: `Bearer ${at}` } });
  if (!res.ok) throw new Error(`Classroom API error ${res.status}`);
  const json = await res.json();
  return (json.courses ?? []).map((c: any) => ({ id: c.id, name: c.name, section: c.section ?? "" }));
}

export async function getCourseWork(courseId: string): Promise<CourseWork[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const at = await getAccessToken(user.id);
  const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?courseWorkStates=PUBLISHED&pageSize=50`, { headers: { Authorization: `Bearer ${at}` } });
  if (!res.ok) throw new Error(`Classroom API error: ${res.status}`);
  const json = await res.json();
  return (json.courseWork ?? []).map((cw: any) => ({ id: cw.id, title: cw.title, state: cw.state }));
}

export async function getSubmissions(courseId: string, courseWorkId: string): Promise<StudentSubmission[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const at = await getAccessToken(user.id);

  const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?pageSize=100`, { headers: { Authorization: `Bearer ${at}` } });
  if (!res.ok) throw new Error(`Classroom API error: ${res.status}`);
  const json = await res.json();

  return (json.studentSubmissions ?? [])
    .filter((s: any) => s.state === "TURNED_IN" || s.state === "RETURNED")
    .map((s: any) => ({
      submissionId: s.id,
      studentId: s.userId,
      state: s.state,
      driveFiles: (s.assignmentSubmission?.attachments ?? [])
        .filter((a: any) => a.driveFile)
        .map((a: any) => ({ id: a.driveFile.id, name: a.driveFile.title })),
    }))
    .filter((s: any) => s.driveFiles.length > 0);
}
