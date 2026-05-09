import { createClient } from "@/lib/supabase/server";
import ReviewCanvas from "@/components/review-canvas";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function ReviewDataLoader({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = await paramsPromise;
  const supabase = await createClient();

  const { data: submission, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (!submission || error) return redirect("/protected");

  // The file lives in Google Drive — serve it via our proxy API route
  // so the browser can display it without exposing OAuth tokens client-side
  const driveFileIds = (submission.drive_file_ids as string[]) || (submission.drive_file_id ? [submission.drive_file_id] : []);
  const imageUrls = driveFileIds.map(id => `/api/drive-file/${id}`);

  return <ReviewCanvas submission={submission} signedUrls={imageUrls} />;
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading review canvas...</div>}>
      <ReviewDataLoader paramsPromise={params} />
    </Suspense>
  );
}