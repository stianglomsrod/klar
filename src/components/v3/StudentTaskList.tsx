"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import {
  completeOwnTaskAction,
  undoOwnTaskCompletionAction,
} from "@/app/actions/v3/task-actions";
import { createClientUuid } from "@/lib/client-uuid";
import type {
  StudentProgressSummary,
  StudentTodayTask,
  TaskProgressResult,
} from "@/server/tasks/task-service";
import type { StudentTaskStatus } from "@/server/supabase/database.types";
import type { StudentExperience } from "@/server/students/experience-service";
import {
  StudentTaskDialog,
  type StudentTaskDialogMode,
} from "./StudentTaskDialog";

const STATUS_LABELS: Record<StudentTaskStatus, string> = {
  assigned: "Klar",
  completed: "Ferdig",
  reopened: "Åpnet igjen",
};

const SUBJECT_PRESENTATION: Record<
  string,
  { emoji: string; surface: string; accent: string }
> = {
  norsk: {
    emoji: "✏️",
    surface: "from-rose-50 to-orange-50",
    accent: "text-rose-800",
  },
  matematikk: {
    emoji: "📐",
    surface: "from-blue-50 to-indigo-50",
    accent: "text-blue-800",
  },
  engelsk: {
    emoji: "💬",
    surface: "from-sky-50 to-cyan-50",
    accent: "text-sky-800",
  },
  samfunnsfag: {
    emoji: "🌍",
    surface: "from-amber-50 to-orange-50",
    accent: "text-amber-900",
  },
  naturfag: {
    emoji: "🌱",
    surface: "from-emerald-50 to-teal-50",
    accent: "text-emerald-900",
  },
  krle: {
    emoji: "🕊️",
    surface: "from-violet-50 to-fuchsia-50",
    accent: "text-violet-900",
  },
};

const FALLBACK_PRESENTATION = {
  emoji: "📚",
  surface: "from-indigo-50 to-sky-50",
  accent: "text-indigo-900",
};

type ProgressCommand = "complete" | "undo";

type SubjectGroup = {
  name: string;
  tasks: StudentTodayTask[];
};

function groupTasksBySubject(tasks: StudentTodayTask[]): SubjectGroup[] {
  const grouped = new Map<string, StudentTodayTask[]>();
  for (const task of tasks) {
    const name = task.subject?.trim() || "Oppgaver";
    const group = grouped.get(name) ?? [];
    group.push(task);
    grouped.set(name, group);
  }
  return [...grouped.entries()].map(([name, groupedTasks]) => ({
    name,
    tasks: groupedTasks,
  }));
}

function getSubjectPresentation(subject: string) {
  return SUBJECT_PRESENTATION[subject.toLocaleLowerCase("nb-NO")] ?? FALLBACK_PRESENTATION;
}

function StudentProgressDock({
  progress,
  completedCount,
  taskCount,
}: {
  progress: StudentProgressSummary;
  completedCount: number;
  taskCount: number;
}) {
  const levelFloor = Math.max(0, (progress.currentLevel - 1) * 1000);
  const xpInLevel = Math.min(1000, Math.max(0, progress.xpBalance - levelFloor));

  return (
    <section
      role="region"
      aria-label="Din fremdrift"
      className="student-progress-dock fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6">
        <div className="shrink-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
            Nivå {progress.currentLevel}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">
            {progress.xpBalance} poeng
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <span>Mot nivå {progress.currentLevel + 1}</span>
            <span>{xpInLevel} / 1000</span>
          </div>
          <progress
            value={xpInLevel}
            max={1000}
            aria-label={`${xpInLevel} av 1000 poeng mot nivå ${progress.currentLevel + 1}`}
            className="mt-1.5 h-2.5 w-full accent-emerald-600"
          />
        </div>
        <div className="hidden shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 sm:inline-flex">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          {completedCount} av {taskCount}
        </div>
      </div>
    </section>
  );
}

export function StudentTaskList({
  initialTasks,
  initialProgress,
  experience,
}: {
  initialTasks: StudentTodayTask[];
  initialProgress: StudentProgressSummary;
  experience: StudentExperience;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [progress, setProgress] = useState(initialProgress);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<StudentTaskDialogMode>("task");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const mutationInFlight = useRef(false);

  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setProgress(initialProgress), [initialProgress]);

  useEffect(() => {
    if (activeTaskId && !tasks.some((task) => task.assignmentId === activeTaskId)) {
      setActiveTaskId(null);
      setDialogMode("task");
    }
  }, [activeTaskId, tasks]);

  const subjectGroups = useMemo(() => groupTasksBySubject(tasks), [tasks]);
  const activeTask =
    tasks.find((task) => task.assignmentId === activeTaskId) ?? null;
  const nextTaskId = tasks.find((task) => task.status !== "completed")?.assignmentId;
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const hasPendingMutation = updatingId !== null;

  function commandKey(task: StudentTodayTask, command: ProgressCommand): string {
    return `${task.assignmentId}:${command}`;
  }

  function applyResult(result: TaskProgressResult): void {
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.assignmentId === result.assignmentId
          ? { ...currentTask, status: result.status }
          : currentTask,
      ),
    );
    setProgress({
      xpBalance: result.xpBalance,
      currentLevel: result.currentLevel,
      highestLevel: result.highestLevel,
    });

    if (!result.changed) {
      setFeedback("Oppgaven var allerede oppdatert.");
    } else if (!experience.progressEnabled && result.xpDelta > 0) {
      setFeedback("Oppgaven er ferdig.");
    } else if (!experience.progressEnabled) {
      setFeedback("Oppgaven er klar igjen.");
    } else if (result.newMilestoneLevels.length > 0) {
      setFeedback(`Du er nå på nivå ${result.currentLevel}. Godt jobbet!`);
    } else if (result.xpDelta > 0) {
      setFeedback(`Oppgaven er ferdig. Du fikk ${result.xpDelta} poeng.`);
    } else {
      setFeedback("Oppgaven er klar igjen. Poengene er justert.");
    }
  }

  async function runCommand(
    task: StudentTodayTask,
    command: ProgressCommand,
  ): Promise<void> {
    const key = commandKey(task, command);
    if (mutationInFlight.current) return;

    const requestId = requestIds.current.get(key) ?? createClientUuid();
    requestIds.current.set(key, requestId);
    mutationInFlight.current = true;
    setUpdatingId(task.assignmentId);
    setError(null);
    setFeedback(null);

    try {
      const result =
        command === "complete"
          ? await completeOwnTaskAction(task.assignmentId, requestId)
          : await undoOwnTaskCompletionAction(task.assignmentId, requestId);
      if (!result.success) {
        setError(result.error);
        return;
      }

      requestIds.current.delete(key);
      applyResult(result.progress);
      setActiveTaskId(null);
      setDialogMode("task");
    } catch {
      setError("Kunne ikke lagre akkurat nå. Prøv igjen.");
    } finally {
      mutationInFlight.current = false;
      setUpdatingId(null);
    }
  }

  function openTask(task: StudentTodayTask) {
    setError(null);
    setFeedback(null);
    setDialogMode("task");
    setActiveTaskId(task.assignmentId);
  }

  function closeTask() {
    if (mutationInFlight.current) return;
    setActiveTaskId(null);
    setDialogMode("task");
    setError(null);
  }

  if (tasks.length === 0) {
    return (
      <div>
        <div className="rounded-3xl border border-sky-100 bg-white p-8 text-center shadow-sm">
          <span aria-hidden="true" className="text-5xl">
            🌤️
          </span>
          <h2 className="mt-4 text-2xl font-black">Du er klar</h2>
          <p className="mt-2 text-slate-600">
            Det er ingen publiserte oppgaver akkurat nå.
          </p>
        </div>
        {experience.progressEnabled && (
          <StudentProgressDock
            progress={progress}
            completedCount={0}
            taskCount={0}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div aria-live="polite" aria-atomic="true">
        {feedback && (
          <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-900">
            {feedback}
          </p>
        )}
      </div>
      {error && !activeTask && (
        <p
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}

      <div className="space-y-8">
        {subjectGroups.map((group) => {
          const presentation = getSubjectPresentation(group.name);
          const groupCompleted = group.tasks.filter(
            (task) => task.status === "completed",
          ).length;
          const headingId = `subject-${group.name
            .toLocaleLowerCase("nb-NO")
            .replace(/[^a-z0-9æøå]+/g, "-")}`;

          return (
            <section key={group.name} aria-labelledby={headingId}>
              <div
                className={`rounded-3xl bg-gradient-to-r ${presentation.surface} px-5 py-5 shadow-sm sm:px-7 sm:py-6`}
              >
                <div className="flex items-center gap-4">
                  <span aria-hidden="true" className="text-4xl sm:text-5xl">
                    {presentation.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      id={headingId}
                      className={`text-2xl font-black tracking-tight sm:text-3xl ${presentation.accent}`}
                    >
                      {group.name}
                    </h2>
                    {experience.progressEnabled && (
                      <p className="mt-1 font-semibold text-slate-700">
                        {groupCompleted} av {group.tasks.length} ferdige
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {group.tasks.map((task) => {
                  const isNext = task.assignmentId === nextTaskId;
                  const supportLevel = Math.min(
                    task.supportLevel,
                    experience.supportLevel,
                  );

                  return (
                    <article
                      key={task.assignmentId}
                      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow focus-within:shadow-md ${
                        isNext
                          ? "border-indigo-400 ring-4 ring-indigo-100"
                          : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openTask(task)}
                        aria-label={`Åpne oppgaven ${task.title}`}
                        className="group flex min-h-44 w-full flex-col p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 sm:p-6"
                      >
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="min-w-0">
                            {isNext && (
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                Neste
                              </p>
                            )}
                            <h3 className="mt-1 text-xl font-black leading-tight text-slate-950">
                              {task.title}
                            </h3>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                              task.status === "completed"
                                ? "bg-emerald-50 text-emerald-800"
                                : task.status === "reopened"
                                  ? "bg-amber-50 text-amber-900"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {STATUS_LABELS[task.status]}
                          </span>
                        </div>

                        {supportLevel >= 2 && task.description && (
                          <p className="mt-3 line-clamp-3 leading-6 text-slate-600">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-auto flex w-full items-end justify-between gap-3 pt-5">
                          {experience.progressEnabled && task.status !== "completed" ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-900">
                              <Sparkles aria-hidden="true" className="h-4 w-4" />
                              {task.pointsValue} poeng
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="inline-flex min-h-11 items-center gap-1 font-bold text-indigo-700 group-hover:text-indigo-900">
                            Åpne
                            <ChevronRight aria-hidden="true" className="h-5 w-5" />
                          </span>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <StudentTaskDialog
        task={activeTask}
        mode={dialogMode}
        experience={experience}
        isUpdating={updatingId === activeTask?.assignmentId}
        hasPendingMutation={hasPendingMutation}
        error={error}
        onClose={closeTask}
        onShowCheckpoint={() => {
          setError(null);
          setDialogMode("checkpoint");
        }}
        onCancelCheckpoint={() => {
          setError(null);
          setDialogMode("task");
        }}
        onComplete={() => {
          if (activeTask) void runCommand(activeTask, "complete");
        }}
        onUndo={() => {
          if (activeTask) void runCommand(activeTask, "undo");
        }}
      />

      {experience.progressEnabled && (
        <StudentProgressDock
          progress={progress}
          completedCount={completedCount}
          taskCount={tasks.length}
        />
      )}
    </div>
  );
}
