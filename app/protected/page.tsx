import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard-client";

async function DashboardData() {
  await connection();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/");

  const { data: collabRows } = await supabase
    .from("teacher_collaborators")
    .select("owner_teacher_id")
    .eq("collaborator_user_id", user.id);

  const visibleTeacherIds = [
    user.id,
    ...((collabRows ?? []).map((r) => r.owner_teacher_id)),
  ];
  const uniqueTeacherIds = [...new Set(visibleTeacherIds)];

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*")
    .in("teacher_id", uniqueTeacherIds)
    .order("created_at", { ascending: false });

  return (
    <DashboardClient
      userName={user.user_metadata?.full_name ?? user.email ?? "Teacher"}
      submissions={submissions ?? []}
    />
  );
}

export default function ProtectedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
          Loading dashboard...
        </div>
      }
    >
      <DashboardData />
    </Suspense>
  );
}