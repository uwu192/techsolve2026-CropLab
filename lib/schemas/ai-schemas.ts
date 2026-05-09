import { z } from "zod";

export const ExtractorSchema = z.object({
  transcript: z.string().describe("The transcription of the handwritten text."),
  uncertain_phrases: z.array(z.string()).describe("Phrases that were difficult to read."),
});

export const ReconciliationSchema = z.object({
  final_transcript: z.string().describe("The final, corrected transcript after comparing multiple versions."),
  resolved_conflicts: z.array(z.object({
    original_a: z.string(),
    original_b: z.string(),
    chosen_resolution: z.string(),
    reason: z.string()
  })).describe("A log of where the two readers disagreed and how you resolved it."),
  is_uncertain: z.boolean().describe("True if even after reconciliation, the text remains illegible."),
  uncertain_phrases: z.array(z.string()).describe("Final list of phrases that remain uncertain.")
});

export const GraderSchema = z.object({
  suggested_grade: z.number().describe("Numeric grade based on rubric."),
  feedback_draft: z.string().describe("Markdown feedback for the student."),
  rubric_alignment_score: z.number().describe("Score from 0.0 to 1.0.")
});

export const RefinerSchema = z.object({
  refined_feedback: z.string(),
  final_grade: z.number(),
  critique_notes: z.string()
});