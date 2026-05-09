"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { approveAndSync, rejectSubmissionDraft } from "@/app/actions/submissions";

type SubmissionRow = {
  id: string;
  extracted_text: string | null;
  uncertain_phrases?: string[] | null;
  is_uncertain?: boolean | null;
  suggested_grade: number | null;
  feedback_draft: string | null;
  rubric_alignment_score?: number | null;
};

export default function ReviewCanvas({
  submission,
  signedUrls,
}: {
  submission: SubmissionRow;
  signedUrls: string[];
}) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    setIsSyncing(true);
    try {
      await approveAndSync(submission.id);
      router.push("/protected");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Archive this draft without syncing to Classroom?")) return;
    setIsRejecting(true);
    try {
      await rejectSubmissionDraft(submission.id);
      router.push("/protected");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRejecting(false);
    }
  };

  const phrases = submission.uncertain_phrases ?? [];

  const highlightText = (text: string, uncertain: string[]) => {
    if (!uncertain.length) return text;
    let highlighted = text;
    uncertain.forEach((phrase) => {
      if (!phrase.trim()) return;
      const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      highlighted = highlighted.replace(
        regex,
        '<mark class="bg-amber-200/90 text-black px-0.5 rounded-sm font-medium">$1</mark>'
      );
    });
    return highlighted;
  };

  const formattedTranscript = highlightText(submission.extracted_text || "", phrases);

  const alignmentPct =
    submission.rubric_alignment_score != null
      ? Math.round(Math.min(1, Math.max(0, submission.rubric_alignment_score)) * 100)
      : null;

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-black dark:text-white">Review Submission</h1>
          <div className="flex flex-wrap gap-2 items-center">
            {submission.is_uncertain && (
              <span className="bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-100 text-xs px-2 py-1 rounded border border-orange-200 dark:border-orange-800">
                Uncertain handwriting — review yellow highlights
              </span>
            )}
            {phrases.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {phrases.length} flagged phrase{phrases.length !== 1 ? "s" : ""} in transcript
              </span>
            )}
            {alignmentPct != null && (
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300 border border-violet-300/50 rounded px-2 py-0.5">
                Rubric alignment ~{alignmentPct}%
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isRejecting || isSyncing}
            className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          >
            {isRejecting ? "Archiving…" : "Reject draft"}
          </Button>
          <Button onClick={handleApprove} disabled={isSyncing || isRejecting}>
            {isSyncing ? "Syncing…" : "Approve & sync to Classroom"}
          </Button>
        </div>
      </div>

      {/* @ts-expect-error ResizablePanelGroup ref typing */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel
          defaultSize={50}
          className="relative bg-gray-900 overflow-auto flex items-center justify-center p-4"
        >
                    <div className="flex flex-col gap-4 w-full h-full min-h-[800px]">
            {signedUrls.map((url, idx) => (
              <img key={idx} src={url} alt={`Page ${idx + 1}`} className="object-contain w-full rounded border border-white/10" />
            ))}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />

        <ResizablePanel defaultSize={50} className="p-6 overflow-auto bg-white dark:bg-gray-950">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2 text-black dark:text-white">Transcription</h2>
              <div
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded border prose dark:prose-invert text-black dark:text-gray-100 max-w-none"
                dangerouslySetInnerHTML={{
                  __html: formattedTranscript.replace(/\n/g, "<br/>"),
                }}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2 text-black dark:text-white">
                Draft feedback
                {submission.suggested_grade != null && (
                  <span className="text-green-600 dark:text-green-400 font-normal text-base ml-2">
                    (suggested {submission.suggested_grade} pts)
                  </span>
                )}
              </h2>
              <textarea
                className="w-full h-64 p-4 border rounded font-mono text-sm text-black dark:text-gray-100 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                defaultValue={submission.feedback_draft || ""}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
