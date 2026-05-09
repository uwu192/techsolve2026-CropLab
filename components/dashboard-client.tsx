"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getClassroomCourses, getCourseWork, getSubmissions } from "@/app/actions/classroom";
import type { Course, CourseWork, StudentSubmission } from "@/app/actions/classroom";
import { startBatchGrading } from "@/app/actions/batch-grade";
import { deleteAllSubmissions } from "@/app/actions/delete-submissions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Submission = {
  drive_file_ids?: string[];
  id: string; course_id: string; assignment_id: string;
  student_id: string; status: string;
  suggested_grade: number | null; created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:         "bg-gray-500/20 text-gray-300 border-gray-500",
  PROCESSING:      "bg-blue-500/20 text-blue-300 border-blue-500",
  DRAFT_READY:     "bg-yellow-500/20 text-yellow-300 border-yellow-500",
  SYNCED:          "bg-green-500/20 text-green-300 border-green-500",
  FAILED:          "bg-red-500/20 text-red-300 border-red-500",
  REAUTH_REQUIRED: "bg-orange-500/20 text-orange-300 border-orange-500",
  ARCHIVED:        "bg-purple-500/20 text-purple-300 border-purple-500",
};

type Step = "idle" | "courses" | "coursework" | "submissions";

interface Props { userName: string; submissions: Submission[]; }

function actionErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return "Something went wrong";
}

export function DashboardClient({ userName, submissions }: Props) {
  const router = useRouter();
  const [pipelineBusy, setPipelineBusy] = useState(false);

  useEffect(() => {
    const hasActive = submissions.some(
      (s) => s.status === "PENDING" || s.status === "PROCESSING"
    );
    if (!hasActive) return;
    const id = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(id);
  }, [submissions, router]);

  const [step, setStep] = useState<Step>("idle");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseWorks, setCourseWorks] = useState<CourseWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<CourseWork | null>(null);
  const [studentSubs, setStudentSubs] = useState<StudentSubmission[]>([]);
  const [rubric, setRubric] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleScan = async () => {
    setError(null);
    setSuccessMsg(null);
    setPipelineBusy(true);
    try {
      const data = await getClassroomCourses();
      setCourses(data);
      setStep("courses");
    } catch (e: unknown) {
      setError(actionErrorMessage(e));
    } finally {
      setPipelineBusy(false);
    }
  };

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setSelectedWork(null);
    setStudentSubs([]);
    setError(null);
    setPipelineBusy(true);
    try {
      const data = await getCourseWork(course.id);
      setCourseWorks(data);
      setStep("coursework");
    } catch (e: unknown) {
      setError(actionErrorMessage(e));
    } finally {
      setPipelineBusy(false);
    }
  };

  const handleSelectWork = async (work: CourseWork) => {
    setSelectedWork(work);
    setStudentSubs([]);
    setError(null);
    setPipelineBusy(true);
    try {
      const data = await getSubmissions(selectedCourse!.id, work.id);
      setStudentSubs(data);
      setStep("submissions");
    } catch (e: unknown) {
      setError(actionErrorMessage(e));
    } finally {
      setPipelineBusy(false);
    }
  };

  const handleGradeAll = async () => {
    setError(null);
    setSuccessMsg(null);
    const toGrade = studentSubs.map((s) => ({
      studentId: s.studentId,
      driveFileIds: s.driveFiles.map((f) => f.id),
      classroomSubId: s.submissionId,
    }));
    setPipelineBusy(true);
    try {
      const { queued, error: serverError } = await startBatchGrading(
        selectedCourse!.id,
        selectedWork!.id,
        toGrade,
        rubric
      );
      if (serverError) {
        setError(serverError);
      } else {
        setSuccessMsg(`✅ ${queued} submission${queued !== 1 ? "s" : ""} queued for AI grading!`);
        reset();
        router.refresh();
      }
    } catch (e: unknown) {
      setError(actionErrorMessage(e));
    } finally {
      setPipelineBusy(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL submissions? This cannot be undone.")) return;
    setPipelineBusy(true);
    try {
      await deleteAllSubmissions();
      router.refresh();
    } catch (e: unknown) {
      setError(actionErrorMessage(e));
    } finally {
      setPipelineBusy(false);
    }
  };

  const reset = () => {
    setStep("idle"); setCourses([]); setSelectedCourse(null);
    setCourseWorks([]); setSelectedWork(null); setStudentSubs([]);
    setError(null); setSuccessMsg(null);
  };

  const goBack = () => {
    if (step === "coursework") {
      setStep("courses");
      setSelectedCourse(null);
      setCourseWorks([]);
      setError(null);
    } else if (step === "submissions") {
      setStep("coursework");
      setSelectedWork(null);
      setStudentSubs([]);
      setError(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto py-8 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {userName.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1 text-sm">AI-powered grading: Select a class → assignment → review AI feedback → sync to Classroom</p>
      </div>

      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-violet-300">⚡ Start Grading</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              {step === "idle"        && "Click below to scan your Google Classroom, then select a class and assignment to grade all student submissions with AI."}
              {step === "courses"     && "✓ Connected to your Google account. Now pick a class below:"}
              {step === "coursework"  && `✓ Selected: ${selectedCourse?.name}. Now pick an assignment below:`}
              {step === "submissions" && `✓ Found ${studentSubs.length} submission${studentSubs.length !== 1 ? "s" : ""} with files. Enter grading criteria and click "Grade All".`}
            </p>
          </div>
          {step !== "idle" && (
            <div className="flex gap-2">
              {step !== "courses" && (
                <button onClick={goBack} className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/60 rounded px-3 py-1 transition-colors">
                  ← Back
                </button>
              )}
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-300 border border-gray-500/30 hover:border-gray-400/60 rounded px-3 py-1 transition-colors">
                Start Over
              </button>
            </div>
          )}
        </div>

        {step === "idle" && (
          <Button
            type="button"
            onClick={() => void handleScan()}
            disabled={pipelineBusy}
            className="self-start bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2"
          >
            {pipelineBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                Connecting to Google Classroom…
              </>
            ) : (
              "🔍 Scan My Classroom"
            )}
          </Button>
        )}

        {step === "courses" && (
          <div className="flex flex-col gap-2">
            {pipelineBusy && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your classes…
              </div>
            )}
            {!pipelineBusy && courses.length === 0 && (
              <p className="text-sm text-red-400">No active classes found. Make sure you're teaching at least one Classroom course.</p>
            )}
            {courses.length > 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                {courses.length} class{courses.length !== 1 ? "es" : ""} found
              </div>
            )}
            {courses.map(c => (
              <button key={c.id} type="button" onClick={() => void handleSelectCourse(c)} disabled={pipelineBusy}
                className="text-left rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 px-4 py-3 transition-colors cursor-pointer">
                <p className="text-sm font-medium text-white">{c.name}</p>
                {c.section && <p className="text-xs text-muted-foreground">{c.section}</p>}
              </button>
            ))}
          </div>
        )}

        {step === "coursework" && (
          <div className="flex flex-col gap-2">
            {pipelineBusy && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading assignments…
              </div>
            )}
            {!pipelineBusy && courseWorks.length === 0 && (
              <p className="text-sm text-orange-400">No published assignments found in this class.</p>
            )}
            {courseWorks.length > 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                {courseWorks.length} assignment{courseWorks.length !== 1 ? "s" : ""} found
              </div>
            )}
            {courseWorks.map(cw => (
              <button key={cw.id} type="button" onClick={() => void handleSelectWork(cw)} disabled={pipelineBusy}
                className="text-left rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 px-4 py-3 transition-colors cursor-pointer">
                <p className="text-sm font-medium text-white">{cw.title}</p>
              </button>
            ))}
          </div>
        )}

        {step === "submissions" && (
          <div className="flex flex-col gap-4">
            {pipelineBusy && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading submissions…
              </div>
            )}
            {!pipelineBusy && studentSubs.length === 0 ? (
              <p className="text-sm text-orange-400">No student submissions with file attachments found for this assignment.</p>
            ) : (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                <div className="text-xs text-muted-foreground mb-3">
                  Found <span className="text-green-400 font-semibold">{studentSubs.length}</span> student submission{studentSubs.length !== 1 ? "s" : ""} with file{studentSubs.length !== 1 ? "s" : ""}:
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="border-b border-white/10 bg-white/5">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Student</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Files</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentSubs.map(s => (
                        <tr key={s.submissionId} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-2 font-mono text-muted-foreground text-xs">{s.studentId.slice(-8)}</td>
                          <td className="px-3 py-2 text-white">{s.driveFiles.map(f => f.name).join(", ")}</td>
                          <td className="px-3 py-2 text-green-400 font-medium">{s.state}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 bg-white/5 p-4 rounded-lg border border-white/10">
              <label className="text-sm font-semibold text-white">Step 4: Enter Grading Criteria</label>
              <p className="text-xs text-muted-foreground">Tell the AI how to grade this assignment. Be as specific as possible.</p>
              <textarea
                id="rubric-input"
                value={rubric}
                onChange={e => setRubric(e.target.value)}
                rows={6}
                placeholder={`Example:\n\nGrade this essay on causes of World War 1:\n- 10 pts: Identifies at least 3 main causes\n- 10 pts: Uses specific historical evidence\n- 5 pts: Clear organization and writing\n- Total: 25 points\n\nGive benefit of the doubt for unclear handwriting.`}
                className="rounded-md border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y font-mono"
              />
            </div>

            <div className="flex gap-2 justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {!rubric.trim() && studentSubs.length > 0 && (
                  <span className="text-orange-400">⚠ Please enter grading criteria above</span>
                )}
              </div>
              <Button
                type="button"
                onClick={() => void handleGradeAll()}
                disabled={pipelineBusy || !rubric.trim() || studentSubs.length === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pipelineBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    Queuing submissions…
                  </>
                ) : (
                  `▶ Grade All ${studentSubs.length} Submission${studentSubs.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border-2 border-red-500/60 bg-red-500/15 px-4 py-3 text-sm text-red-300">
            <p className="font-semibold">❌ Error</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border-2 border-green-500/60 bg-green-500/15 px-4 py-3 text-sm text-green-300">
            <p className="font-semibold">✅ Success</p>
            <p className="text-xs mt-1">{successMsg}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Submissions ({submissions.length})
          </h2>
          {submissions.length > 0 && (
            <button
              id="delete-all-submissions-btn"
              onClick={() => void handleDeleteAll()}
              disabled={pipelineBusy}
              className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/60 rounded px-3 py-1 transition-colors disabled:opacity-40"
            >
              🗑 Delete All
            </button>
          )}
        </div>

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm gap-2">
            <span className="text-4xl">📭</span>
            <p>No submissions yet. Scan a class above to start grading.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/10">
                <TableHead>Student</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Suggested Grade</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map(sub => (
                <TableRow key={sub.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-mono text-xs">{sub.student_id.slice(-8)}…</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(sub.drive_file_ids?.length ?? (sub.drive_file_id ? 1 : 0))} file(s)
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs gap-1 ${STATUS_COLORS[sub.status] ?? ""}`}
                    >
                      {(sub.status === "PROCESSING" || sub.status === "PENDING") && (
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
                      )}
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sub.suggested_grade != null
                      ? <span className="font-semibold text-green-400">{sub.suggested_grade} pts</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(sub.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {sub.status === "DRAFT_READY" ? (
                      <Button size="sm" variant="outline"
                        className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                        onClick={() => router.push(`/protected/review/${sub.id}`)}>
                        Review →
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        {sub.status === "PROCESSING" || sub.status === "PENDING" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Pipeline…
                          </>
                        ) : sub.status === "SYNCED" ? (
                          "✅ Synced"
                        ) : sub.status === "REAUTH_REQUIRED" ? (
                          "🔑 Re-auth"
                        ) : (
                          "—"
                        )}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
