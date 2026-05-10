import { together } from "../lib/ai/together";
import { inngest } from "./client";
import { NonRetriableError } from "inngest";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { ExtractorSchema } from "../lib/schemas/ai-schemas";
import { createClient } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "../lib/google-token";
import { z } from "zod";

const aiModel = google("gemini-3-flash-preview");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OptimizedGradingSchema = z.object({
  final_transcript: z.string().describe("The most accurate reconciled transcript."),
  suggested_grade: z.number(),
  feedback_draft: z.string(),
  uncertain_phrases: z.array(z.string()),
  is_uncertain: z.boolean(),
  rubric_alignment_score: z.number()
});

async function fetchDriveFileAsBytes(driveFileId: string, accessToken: string) {
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=mimeType,name`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!metaRes.ok) throw new Error(`Drive meta failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  let mimeType: string = meta.mimeType ?? "image/jpeg";
  if (mimeType.startsWith("application/vnd.google-apps")) mimeType = "application/pdf";
  let downloadUrl = mimeType === "application/pdf" ? `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/pdf` : `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
  const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!fileRes.ok) throw new Error(`Drive download failed: ${fileRes.status}`);
  return { bytes: new Uint8Array(await fileRes.arrayBuffer()), mimeType, name: meta.name };
}

async function getInterleavedContent(driveFileIds: string[], accessToken: string, promptPrefix: string) {
  const files = [];
  for (const id of driveFileIds) {
    files.push(await fetchDriveFileAsBytes(id, accessToken));
  }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const content: any[] = [{ type: "text", text: promptPrefix }];
  files.forEach((f, i) => {
    content.push({ type: "text", text: `--- Page ${i + 1} ---` });
    if (f.mimeType === "application/pdf") content.push({ type: "file", data: f.bytes, mediaType: "application/pdf" });
    else content.push({ type: "image", image: f.bytes, mediaType: f.mimeType || "image/jpeg" });
  });
  return content;
}

export const processSubmissionPipeline = inngest.createFunction(
  { 
    id: "process-assignment-pipeline", 
    triggers: [{ event: "submissions/process" }],
    concurrency: 10, // OPTIMIZATION: Process 10 students in parallel
    retries: 1 
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { submissionId, driveFileIds, teacherId, rubric } = event.data;

    const accessToken = await step.run("get-access-token", async () => {
      const { data: tokenRow } = await supabaseAdmin.from("user_provider_tokens").select("provider_refresh_token").eq("user_id", teacherId).single();
      if (!tokenRow) throw new NonRetriableError("No token found.");
      return await refreshGoogleAccessToken(tokenRow.provider_refresh_token);
    });

    await step.run("update-status-processing", async () => {
      await supabaseAdmin.from("submissions").update({ status: "PROCESSING", error_message: null }).eq("id", submissionId);
    });

    // STEP 1: PARALLEL READERS (STAYS THE SAME FOR QUALITY)
    const [readerA, readerB] = await Promise.all([
      step.run("reader-primary", async () => {
        const content = await getInterleavedContent(driveFileIds, accessToken, "Transcribe exactly. No context.");
        const { object } = await generateObject({ model: aiModel, schema: ExtractorSchema, temperature: 0, messages: [{ role: "user", content }] });
        return object;
      }),
      step.run("reader-skeptical", async () => {
        const content = await getInterleavedContent(driveFileIds, accessToken, "Transcribe critically. Be skeptical. No context.");
        const { object } = await generateObject({ model: aiModel, schema: ExtractorSchema, temperature: 0, messages: [{ role: "user", content }] });
        return object;
      })
    ]);

    // STEP 2: CONSOLIDATED EXPERT PANEL (Reconciler + Grader + Refiner)
    // This saves 2 sequential AI round-trips (~15-20 seconds total)
    const finalResult = await step.run("expert-panel-grading", async () => {
      const { object } = await generateObject({
        model: aiModel,
        schema: OptimizedGradingSchema,
        temperature: 0,
        messages: [
          { role: "system", content: `You are an expert teacher. 1. Reconcile these two transcripts into a perfect grounded copy. 2. Grade based on rubric: ${rubric}. 3. Refine feedback to be fair and professional.` },
          { role: "user", content: `Transcript A: ${readerA.transcript}\n\nTranscript B: ${readerB.transcript}` }
        ],
      });
      return object;
    });

    await step.run("update-db-final", async () => {
      await supabaseAdmin.from("submissions").update({
        status: "DRAFT_READY",
        extracted_text: finalResult.final_transcript,
        feedback_draft: finalResult.feedback_draft,
        suggested_grade: finalResult.suggested_grade,
        rubric_alignment_score: finalResult.rubric_alignment_score,
        uncertain_phrases: finalResult.uncertain_phrases,
        is_uncertain: finalResult.is_uncertain,
        error_message: null
      }).eq("id", submissionId);
    });

    return { success: true };
  }
);
