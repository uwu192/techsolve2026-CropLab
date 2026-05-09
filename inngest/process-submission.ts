import { together } from "../lib/ai/together";
import { inngest } from "./client";
import { NonRetriableError } from "inngest";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { ExtractorSchema, ReconciliationSchema, GraderSchema, RefinerSchema } from "../lib/schemas/ai-schemas";
import { createClient } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "../lib/google-token";

const aiModel = google("gemini-3-flash-preview");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchDriveFileAsBytes(driveFileId: string, accessToken: string) {
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=mimeType,name`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!metaRes.ok) throw new Error(`Drive meta failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  let mimeType: string = meta.mimeType ?? "image/jpeg";
  if (mimeType.startsWith("application/vnd.google-apps")) mimeType = "application/pdf";
  let downloadUrl = mimeType === "application/pdf"
    ? `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/pdf`
    : `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
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
    content.push({ type: "text", text: `--- Start Page ${i + 1} ---` });
    if (f.mimeType === "application/pdf") content.push({ type: "file", data: f.bytes, mediaType: "application/pdf" });
    else content.push({ type: "image", image: f.bytes, mediaType: f.mimeType || "image/jpeg" });
  });
  return content;
}

export const processSubmissionPipeline = inngest.createFunction(
  { id: "process-assignment-pipeline", triggers: [{ event: "submissions/process" }], retries: 1 },
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

    // AGENT 1 & 2: DUAL TRANSCRIPTION
    const [readerA, readerB] = await Promise.all([
      step.run("reader-primary", async () => {
        const content = await getInterleavedContent(driveFileIds, accessToken, "Transcribe the student handwriting EXACTLY. Do not add external context. If text is missing or unreadable, mark it so. Focus 100% on the visible words.");
        const { object } = await generateObject({ model: aiModel, schema: ExtractorSchema, temperature: 0, messages: [{ role: "user", content }] });
        return object;
      }),
      step.run("reader-skeptical", async () => {
        const content = await getInterleavedContent(driveFileIds, accessToken, "Transcribe critically. Be extremely skeptical. Flag any unclear text. DO NOT GUESS OR INVENT STORIES.");
        const { object } = await generateObject({ model: aiModel, schema: ExtractorSchema, temperature: 0, messages: [{ role: "user", content }] });
        return object;
      })
    ]);

    // AGENT 3: RECONCILIATION
    const reconciliation = await step.run("reconciler", async () => {
      const { object } = await generateObject({
        model: aiModel,
        schema: ReconciliationSchema,
        temperature: 0,
        messages: [{ role: "system", content: "Compare two student work transcriptions. Produce the most accurate final version. Remove any hallucinations that are not present in both copies unless clearly visible." }, { role: "user", content: `A: ${readerA.transcript}\n\nB: ${readerB.transcript}` }],
      });
      return object;
    });

    // AGENT 4: GRADER
    const rawGrade = await step.run("grader", async () => {
      const { object } = await generateObject({
        model: aiModel,
        schema: GraderSchema,
        temperature: 0,
        messages: [{ role: "system", content: `Grade based on rubric: ${rubric}` }, { role: "user", content: `Transcript:\n${reconciliation.final_transcript}` }],
      });
      return object;
    });

    // AGENT 5: REFINER
    const finalReview = await step.run("refiner", async () => {
      const { object } = await generateObject({
        model: aiModel,
        schema: RefinerSchema,
        temperature: 0,
        messages: [{ role: "system", content: "Final fairness check. Ensure the feedback is grounded in the transcript and follows the rubric." }, { role: "user", content: `Rubric: ${rubric}\nTranscript: ${reconciliation.final_transcript}\nDraft: ${rawGrade.feedback_draft}\nGrade: ${rawGrade.suggested_grade}` }],
      });
      return object;
    });

    await step.run("update-db-final", async () => {
      await supabaseAdmin.from("submissions").update({
        status: "DRAFT_READY",
        extracted_text: reconciliation.final_transcript,
        feedback_draft: finalReview.refined_feedback,
        suggested_grade: finalReview.final_grade,
        rubric_alignment_score: rawGrade.rubric_alignment_score,
        uncertain_phrases: reconciliation.uncertain_phrases,
        is_uncertain: reconciliation.is_uncertain,
        error_message: null
      }).eq("id", submissionId);
    });

    return { success: true };
  }
);
