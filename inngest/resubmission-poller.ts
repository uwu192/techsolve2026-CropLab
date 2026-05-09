import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "../lib/google-token";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLASSROOM_FETCH_CONCURRENCY = 6;
const CHUNK_GAP_MS = 120;

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  gapMs: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item) => worker(item)));
    if (i + chunkSize < items.length && gapMs > 0) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}

/**
 * Scheduled Inngest function that runs every 2 minutes.
 *
 * For every submission that is not terminal (SYNCED, ARCHIVED, etc.),
 * it re-checks the Classroom API for the latest Drive file attachments.
 * If the student has changed their file set, it re-queues the pipeline.
 */
export const resubmissionPoller = inngest.createFunction(
  {
    id: "resubmission-poller",
    triggers: [{ cron: "*/2 * * * *" }],
  },
  async ({ step }: { step: any }) => {
    await step.run("poll-resubmissions", async () => {
      const { data: activeRows, error } = await supabaseAdmin
        .from("submissions")
        .select("id, teacher_id, course_id, assignment_id, classroom_submission_id, drive_file_ids, rubric, status")
        .not("classroom_submission_id", "is", null)
        .not("status", "in", '("SYNCED","ARCHIVED","REAUTH_REQUIRED","FAILED")');

      if (error || !activeRows?.length) return { checked: 0, requeued: 0 };

      let requeued = 0;

      const byTeacher = activeRows.reduce<Record<string, typeof activeRows>>(
        (acc, row) => {
          (acc[row.teacher_id] ??= []).push(row);
          return acc;
        },
        {}
      );

      for (const [teacherId, rows] of Object.entries(byTeacher)) {
        const { data: tokenRow } = await supabaseAdmin
          .from("user_provider_tokens")
          .select("provider_refresh_token")
          .eq("user_id", teacherId)
          .single();

        if (!tokenRow?.provider_refresh_token) continue;

        let accessToken: string;
        try {
          accessToken = await refreshGoogleAccessToken(tokenRow.provider_refresh_token);
        } catch (err) {
          console.warn(`resubmission-poller: token refresh failed for teacher ${teacherId}`, err);
          continue;
        }

        await runInChunks(
          rows,
          CLASSROOM_FETCH_CONCURRENCY,
          CHUNK_GAP_MS,
          async (row) => {
            // STATE PROTECTION: Skip if already processing
            if (row.status === "PROCESSING") return;

            const res = await fetch(
              `https://classroom.googleapis.com/v1/courses/${row.course_id}/courseWork/${row.assignment_id}/studentSubmissions/${row.classroom_submission_id}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!res.ok) return;
            const sub = await res.json();

            const latestFileIds: string[] = (
              sub.assignmentSubmission?.attachments ?? []
            )
              .filter((a: { driveFile?: { id: string } }) => a.driveFile)
              .map((a: { driveFile: { id: string } }) => a.driveFile.id as string);

            if (latestFileIds.length === 0) return;

            // ARRAY NORMALIZATION: Sort for comparison
            const currentIds = [...(row.drive_file_ids || [])].sort();
            const newIds = [...latestFileIds].sort();

            const hasChanged = currentIds.length !== newIds.length || currentIds.some((id, idx) => id !== newIds[idx]);

            if (hasChanged) {
              await supabaseAdmin
                .from("submissions")
                .update({
                  drive_file_ids: latestFileIds,
                  status: "PENDING",
                  extracted_text: null,
                  uncertain_phrases: [],
                  feedback_draft: null,
                  suggested_grade: null,
                  rubric_alignment_score: null,
                  is_uncertain: false,
                })
                .eq("id", row.id);

              await inngest.send({
                name: "submissions/process",
                data: {
                  submissionId: row.id,
                  driveFileIds: latestFileIds,
                  teacherId,
                  rubric: row.rubric ?? "",
                },
              });

              requeued++;
              console.log(
                `Resubmission detected for submission ${row.id} — re-queued with ${latestFileIds.length} files`
              );
            }
          }
        );
      }

      return { checked: activeRows.length, requeued };
    });
  }
);
