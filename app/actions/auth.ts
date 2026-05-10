"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      // Added coursework.me scope for writing grades
      scopes: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.coursework.me https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/drive.readonly",
      queryParams: {
        access_type: "offline",
        // Force account selection and consent every time to ensure we get a refresh_token
        prompt: "select_account consent",
      },
    },
  });

  if (error) {
    return redirect("/auth/error?message=Could not authenticate with Google");
  }

  if (data.url) {
    redirect(data.url);
  }
}
