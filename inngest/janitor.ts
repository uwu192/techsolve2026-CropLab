import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Purge old terminal submissions from Postgres. Grading reads Google Drive directly;
 * nothing is stored in Supabase Storage for student files in the current pipeline.
 *
 * Deletes rows older than 7 days whose workflow has finished (synced, archived,
 * or hard-failed). In-flight work (PENDING, PROCESSING, DRAFT_READY, REAUTH_REQUIRED)
 * is kept.
 */
export const submissionJanitor = inngest.createFunction(
  { id: "submission-db-janitor", triggers: [{ cron: "0 0 * * *" }] },
  async ({ step }: { step: any }) => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const deleted = await step.run("purge-stale-terminal-submissions", async () => {
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .delete()
        .in("status", ["SYNCED", "ARCHIVED", "FAILED"])
        .lt("created_at", cutoff)
        .select("id");

      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    });

    return { status: `Deleted ${deleted} submission row(s) older than 7d in terminal states` };
  }
);
