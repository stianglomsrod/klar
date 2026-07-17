"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Flower2, Sparkles } from "lucide-react";
import {
  completeOwnTaskAction,
  undoOwnTaskCompletionAction,
} from "@/app/actions/v3/task-actions";
import { createClientUuid } from "@/lib/client-uuid";
import {
  getStudentSubjectPresentation,
  groupStudentTasksBySubject,
} from "@/lib/student-subjects";
import type {
  StudentProgressSummary,
  StudentTodayTask,
  TaskProgressResult,
} from "@/server/tasks/task-service";
import type { StudentTaskStatus } from "@/server/supabase/database.types";
import type { StudentExperience } from "@/server/students/experience-service";
import type { StudentHelpState } from "@/server/help/help-service";
import { getStudentProgressDockLabel } from "@/lib/student-progress-dock-label";
import { StudentHelpControl } from "./StudentHelpControl";
import { StudentHelpQueueRealtime } from "./useHelpQueueRealtime";
import {
  StudentTaskDialog,
  type StudentTaskDialogMode,
} from "./StudentTaskDialog";

const STATUS_LABELS: Record<StudentTaskStatus, string> = {
  assigned: "Klar",
  completed: "Ferdig",
  reopened: "Åpnet igjen",
};

type ProgressCommand = "complete" | "undo";

export type StudentTaskSection = {
  id: string;
  name: string;
  subject: string | null;
  relation: "previous" | "current" | "next" | null;
  startsAt: string | null;
  endsAt: string | null;
  assignmentIds: string[];
};

type TaskGroup = Omit<StudentTaskSection, "assignmentIds"> & {
  tasks: StudentTodayTask[];
};

const timeFormatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
});

function relationLabel(relation: StudentTaskSection["relation"]): string | null {
  switch (relation) {
    case "previous":
      return "Forrige økt";
    case "current":
      return "Nå";
    case "next":
      return "Neste økt";
    default:
      return null;
  }
}

export function StudentProgressDock({
  progress,
  completedCount,
  taskCount,
  showProgress,
  helpState,
}: {
  progress: StudentProgressSummary;
  completedCount: number;
  taskCount: number;
  showProgress: boolean;
  helpState: StudentHelpState;
}) {
  const levelFloor = Math.max(0, (progress.currentLevel - 1) * 1000);
  const xpInLevel = Math.min(1000, Math.max(0, progress.xpBalance - levelFloor));
  const regionLabel = getStudentProgressDockLabel(
    showProgress,
    Boolean(helpState.queue),
  );

  return (
    <section
      role="region"
      aria-label={regionLabel}
      className="student-progress-dock fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div
        className={`mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2 min-[24rem]:flex-row min-[24rem]:items-center min-[24rem]:gap-4 sm:gap-6 sm:px-6 ${showProgress ? "" : "items-end"}`}
      >
        {showProgress && (
          <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 min-[24rem]:flex-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                Nivå {progress.currentLevel}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">
                {progress.xpBalance} poeng
              </p>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs font-semibold text-slate-600">
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
        )}
        <div className="self-end">
          <StudentHelpControl state={helpState} />
        </div>
      </div>
    </section>
  );
}

export function StudentTaskList({
  initialTasks,
  initialProgress,
  experience,
  helpState,
  sections = [],
  displayAssignmentIds,
  singleGroup,
  helpEligibleAssignmentIds = [],
  helpTransitionAt,
  highlightNextTask = true,
}: {
  initialTasks: StudentTodayTask[];
  initialProgress: StudentProgressSummary;
  experience: StudentExperience;
  helpState: StudentHelpState;
  sections?: StudentTaskSection[];
  displayAssignmentIds?: readonly string[];
  singleGroup?: { id: string; name: string; subject: string | null };
  helpEligibleAssignmentIds?: readonly string[];
  helpTransitionAt?: string | null;
  highlightNextTask?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [progress, setProgress] = useState(initialProgress);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<StudentTaskDialogMode>("task");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newRewardCount, setNewRewardCount] = useState(0);
  const [helpAnnouncement, setHelpAnnouncement] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const helpAnnouncementSequence = useRef(0);
  const currentSession = sections.find(
    (section) => section.relation === "current",
  );
  const nextSession = sections
    .filter(
      (section) =>
        section.startsAt && new Date(section.startsAt).getTime() > Date.now(),
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt!).getTime() - new Date(right.startsAt!).getTime(),
    )[0];
  const requestIds = useRef(new Map<string, string>());
  const mutationInFlight = useRef(false);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousHelpState = useRef(helpState);

  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setProgress(initialProgress), [initialProgress]);

  useEffect(() => {
    const previous = previousHelpState.current;
    let announcement: string | null = null;
    if (previous.activeRequest && !helpState.activeRequest) {
      announcement = "Du står ikke lenger i kø.";
    } else if (!previous.queue && helpState.queue?.status === "open") {
      announcement = "Hjelpekøen er åpen.";
    } else if (previous.queue && !helpState.queue) {
      announcement = "Hjelpekøen er stengt.";
    } else if (
      previous.queue?.status === "open" &&
      helpState.queue?.status === "closing"
    ) {
      announcement = "Hjelpekøen stenger.";
    }
    if (announcement) {
      helpAnnouncementSequence.current += 1;
      setHelpAnnouncement({
        id: helpAnnouncementSequence.current,
        text: announcement,
      });
    }
    previousHelpState.current = helpState;
  }, [helpState]);

  useEffect(() => {
    if (activeTaskId && !tasks.some((task) => task.assignmentId === activeTaskId)) {
      setActiveTaskId(null);
      setDialogMode("task");
    }
  }, [activeTaskId, tasks]);

  const displayedTasks = useMemo(() => {
    if (!displayAssignmentIds) return tasks;
    const visibleIds = new Set(displayAssignmentIds);
    return tasks.filter((task) => visibleIds.has(task.assignmentId));
  }, [displayAssignmentIds, tasks]);
  const taskGroups = useMemo<TaskGroup[]>(() => {
    if (singleGroup) {
      return [{
        ...singleGroup,
        relation: null,
        startsAt: null,
        endsAt: null,
        tasks: displayedTasks,
      }];
    }
    if (sections.length === 0) {
      return groupStudentTasksBySubject(displayedTasks).map((group) => ({
        id: group.key,
        name: group.name,
        subject: group.name,
        relation: null,
        startsAt: null,
        endsAt: null,
        tasks: group.tasks,
      }));
    }
    const taskById = new Map(displayedTasks.map((task) => [task.assignmentId, task]));
    return sections.map((section) => ({
      id: section.id,
      name: section.name,
      subject: section.subject,
      relation: section.relation,
      startsAt: section.startsAt,
      endsAt: section.endsAt,
      tasks: section.assignmentIds.flatMap((assignmentId) => {
        const task = taskById.get(assignmentId);
        return task ? [task] : [];
      }),
    }));
  }, [displayedTasks, sections, singleGroup]);
  const activeTask =
    tasks.find((task) => task.assignmentId === activeTaskId) ?? null;
  const activeTaskSectionId = activeTaskId
    ? sections.find((section) =>
        section.assignmentIds.includes(activeTaskId),
      )?.id ?? null
    : null;
  const showTaskHelpControl = Boolean(
    helpState.queue &&
      ((activeTaskSectionId &&
        activeTaskSectionId === helpState.queue.revisionSessionId) ||
        (activeTaskId && helpEligibleAssignmentIds.includes(activeTaskId))),
  );
  const nextTaskId =
    highlightNextTask && sections.length === 0
      ? displayedTasks.find((task) => task.status !== "completed")?.assignmentId
      : undefined;
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const hasPendingMutation = updatingId !== null;
  const resolvedHelpTransitionAt =
    helpTransitionAt ??
    currentSession?.endsAt ??
    nextSession?.startsAt ??
    null;

  function commandKey(task: StudentTodayTask, command: ProgressCommand): string {
    return `${task.assignmentId}:${task.stateVersion}:${task.scheduleVersion}:${command}`;
  }

  function applyResult(result: TaskProgressResult): void {
    setNewRewardCount(0);
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.assignmentId === result.assignmentId
          ? {
              ...currentTask,
              status: result.status,
              stateVersion: result.stateVersion,
              scheduleVersion: result.scheduleVersion,
            }
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
    } else if (
      result.newMilestoneLevels.length > 0 &&
      experience.flowerRewardsAllowed &&
      experience.flowerRewardsVisible
    ) {
      const rewardCount = result.newMilestoneLevels.length;
      setNewRewardCount(rewardCount);
      setFeedback(
        rewardCount === 1
          ? "Oppgaven er ferdig. Et kronblad venter i blomsterhagen."
          : `Oppgaven er ferdig. ${rewardCount} kronblader venter i blomsterhagen.`,
      );
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
          ? await completeOwnTaskAction(
              task.assignmentId,
              requestId,
              task.stateVersion,
              task.scheduleVersion,
            )
          : await undoOwnTaskCompletionAction(
              task.assignmentId,
              requestId,
              task.stateVersion,
              task.scheduleVersion,
            );
      if (!result.success) {
        setError(result.error);
        return;
      }

      requestIds.current.delete(key);
      applyResult(result.progress);
      if (
        result.progress.newMilestoneLevels.length > 0 &&
        experience.flowerRewardsAllowed &&
        experience.flowerRewardsVisible
      ) {
        router.refresh();
      }
      setActiveTaskId(null);
      setDialogMode("task");
    } catch {
      setError("Kunne ikke lagre akkurat nå. Prøv igjen.");
    } finally {
      mutationInFlight.current = false;
      setUpdatingId(null);
    }
  }

  function openTask(task: StudentTodayTask, trigger: HTMLButtonElement) {
    dialogTriggerRef.current = trigger;
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

  if (displayedTasks.length === 0 && sections.length === 0) {
    return (
      <div>
        <StudentHelpQueueRealtime
          classId={helpState.classId}
          transitionAt={resolvedHelpTransitionAt}
        />
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {helpAnnouncement && (
            <span key={helpAnnouncement.id}>{helpAnnouncement.text}</span>
          )}
        </span>
        <div className="rounded-3xl border border-sky-100 bg-white p-8 text-center shadow-sm">
          <span aria-hidden="true" className="text-5xl">
            🌤️
          </span>
          <h2 className="mt-4 text-2xl font-black">Du er klar</h2>
          <p className="mt-2 text-slate-600">
            Det er ingen publiserte oppgaver akkurat nå.
          </p>
        </div>
        {(experience.progressEnabled || helpState.queue) && (
          <StudentProgressDock
            progress={progress}
            completedCount={0}
            taskCount={0}
            showProgress={experience.progressEnabled}
            helpState={helpState}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <StudentHelpQueueRealtime
        classId={helpState.classId}
        transitionAt={resolvedHelpTransitionAt}
      />
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {helpAnnouncement && (
          <span key={helpAnnouncement.id}>{helpAnnouncement.text}</span>
        )}
      </span>
      <div aria-live="polite" aria-atomic="true">
        {feedback && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-900">
            <p>{feedback}</p>
            {newRewardCount > 0 && (
              <Link
                href="/v3/student/rewards"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 py-2 text-pink-800 underline-offset-4 shadow-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 focus-visible:ring-offset-2"
              >
                <Flower2 aria-hidden="true" className="h-5 w-5" />
                Åpne blomsterhagen
              </Link>
            )}
          </div>
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
        {taskGroups.map((group) => {
          const presentation = getStudentSubjectPresentation(
            group.subject ?? group.name,
          );
          const groupCompleted = group.tasks.filter(
            (task) => task.status === "completed",
          ).length;
          const headingId = `task-group-${group.id}`;
          const temporalLabel = relationLabel(group.relation);
          const compactDisclosure =
            group.relation === "next" ||
            (sections.length > 0 && group.relation === null);
          const timeLabel =
            group.startsAt && group.endsAt
              ? `${timeFormatter.format(new Date(group.startsAt))}–${timeFormatter.format(new Date(group.endsAt))}`
              : null;
          const taskGrid = group.tasks.length > 0 ? (
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
                      onClick={(event) => openTask(task, event.currentTarget)}
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
          ) : (
            <p className="mt-4 rounded-2xl bg-white/80 p-4 text-slate-600">
              Ingen oppgaver i denne økten.
            </p>
          );

          return (
            <section
              key={group.id}
              aria-labelledby={headingId}
              className={
                group.relation === "current"
                  ? "rounded-[2rem] border-2 border-indigo-400 bg-white p-2 shadow-lg ring-4 ring-indigo-100"
                  : group.relation === "previous"
                    ? "opacity-80"
                    : ""
              }
            >
              {singleGroup ? (
                <h2
                  id={headingId}
                  className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
                >
                  {group.name}
                </h2>
              ) : (
                <div
                  className={`rounded-3xl bg-gradient-to-r ${presentation.surface} ${
                    group.relation === "current"
                      ? "px-5 py-6 sm:px-8 sm:py-8"
                      : "px-5 py-4 sm:px-7 sm:py-5"
                  } shadow-sm`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      aria-hidden="true"
                      className={group.relation === "current" ? "text-5xl sm:text-6xl" : "text-4xl"}
                    >
                      {presentation.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      {(temporalLabel || timeLabel) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {temporalLabel && (
                            <p className={`text-xs font-black uppercase tracking-[0.18em] ${
                              group.relation === "current" ? "text-indigo-800" : "text-slate-600"
                            }`}>
                              {temporalLabel}
                            </p>
                          )}
                          {timeLabel && (
                            <p className="text-sm font-bold text-slate-700">{timeLabel}</p>
                          )}
                        </div>
                      )}
                      <h2
                        id={headingId}
                        className={`${group.relation === "current" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} mt-1 font-black tracking-tight ${presentation.accent}`}
                      >
                        {group.name}
                      </h2>
                      {group.subject && group.subject !== group.name && (
                        <p className="mt-1 font-semibold text-slate-700">{group.subject}</p>
                      )}
                      {experience.progressEnabled && (
                        <p className="mt-1 font-semibold text-slate-700">
                          {groupCompleted} av {group.tasks.length} ferdige
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {group.relation === "previous" && group.tasks.length > 0 ? (
                <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <summary className="min-h-11 cursor-pointer rounded-xl px-2 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600">
                    Vis oppgavene fra forrige økt
                  </summary>
                  {taskGrid}
                </details>
              ) : compactDisclosure && group.tasks.length > 0 ? (
                <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <summary className="min-h-11 cursor-pointer rounded-xl px-2 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600">
                    {group.relation === "next"
                      ? `Se ${group.tasks.length} ${group.tasks.length === 1 ? "oppgave" : "oppgaver"} i neste økt`
                      : `Se ${group.tasks.length} ${group.tasks.length === 1 ? "annen oppgave" : "andre oppgaver"}`}
                  </summary>
                  {taskGrid}
                </details>
              ) : (
                taskGrid
              )}
            </section>
          );
        })}
      </div>

      <StudentTaskDialog
        task={activeTask}
        mode={dialogMode}
        returnFocusTarget={dialogTriggerRef.current}
        experience={experience}
        isUpdating={updatingId === activeTask?.assignmentId}
        hasPendingMutation={hasPendingMutation}
        error={error}
        helpState={helpState}
        showHelpControl={showTaskHelpControl}
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

      {(experience.progressEnabled || helpState.queue) && (
        <StudentProgressDock
          progress={progress}
          completedCount={completedCount}
          taskCount={tasks.length}
          showProgress={experience.progressEnabled}
          helpState={helpState}
        />
      )}
    </div>
  );
}
