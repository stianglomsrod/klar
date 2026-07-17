"use client";

import { useState } from "react";
import { updateOwnTaskStatusAction } from "@/app/actions/v3/task-actions";
import type { StudentTodayTask } from "@/server/tasks/task-service";
import type { StudentTaskStatus } from "@/server/supabase/database.types";
import type { StudentExperience } from "@/server/students/experience-service";

const STATUS_LABELS: Record<StudentTaskStatus, string> = {
  not_started: "Ikke startet",
  in_progress: "Pågår",
  completed: "Ferdig",
};

function nextStatus(status: StudentTaskStatus): StudentTaskStatus {
  if (status === "not_started") return "in_progress";
  if (status === "in_progress") return "completed";
  return "not_started";
}

export function StudentTaskList({
  initialTasks,
  experience,
}: {
  initialTasks: StudentTodayTask[];
  experience: StudentExperience;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextTaskId = tasks.find((task) => task.status !== "completed")?.assignmentId;
  const completedCount = tasks.filter((task) => task.status === "completed").length;

  async function advance(task: StudentTodayTask) {
    const status = nextStatus(task.status);
    setUpdatingId(task.assignmentId);
    setError(null);
    try {
      const result = await updateOwnTaskStatusAction(task.assignmentId, status);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.assignmentId === task.assignmentId
            ? { ...currentTask, status }
            : currentTask,
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-3xl border border-sky-100 bg-white p-8 text-center shadow-sm">
        <h2 className="text-2xl font-bold">Du er klar</h2>
        <p className="mt-2 text-slate-600">Det er ingen publiserte oppgaver akkurat nå.</p>
      </div>
    );
  }

  return (
    <div>
      {experience.progressEnabled && (
        <section
          aria-labelledby="student-progress-heading"
          className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="student-progress-heading" className="font-bold text-emerald-950">
              Dagens fremdrift
            </h2>
            <p className="text-sm font-semibold text-emerald-900">
              {completedCount} av {tasks.length} ferdige
            </p>
          </div>
          <progress
            value={completedCount}
            max={tasks.length}
            aria-label={`${completedCount} av ${tasks.length} oppgaver ferdige`}
            className="mt-3 h-3 w-full accent-emerald-700"
          />
          {completedCount === tasks.length && (
            <p role="status" className="mt-2 font-semibold text-emerald-900">
              Alle oppgavene er ferdige. Godt jobbet!
            </p>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      <div className="space-y-4">
        {tasks.map((task) => {
          const isNext = task.assignmentId === nextTaskId;
          const effectiveSupportLevel = Math.min(
            task.supportLevel,
            experience.supportLevel,
          );
          return (
            <article
              key={task.assignmentId}
              className={`rounded-3xl border bg-white p-6 shadow-sm ${
                isNext ? "border-sky-400 ring-4 ring-sky-100" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {isNext && (
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-700">
                      Neste
                    </p>
                  )}
                  <h2 className="mt-1 text-2xl font-bold">{task.title}</h2>
                  {task.subject && <p className="mt-1 text-sm text-slate-600">{task.subject}</p>}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
                  {STATUS_LABELS[task.status]}
                </span>
              </div>

              {effectiveSupportLevel >= 2 && task.description && (
                <p className="mt-4 leading-7 text-slate-700">{task.description}</p>
              )}
              {effectiveSupportLevel >= 3 && task.estimatedMinutes && (
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  Omtrent {task.estimatedMinutes} minutter
                </p>
              )}

              <button
                type="button"
                onClick={() => advance(task)}
                disabled={updatingId === task.assignmentId}
                className="mt-5 rounded-xl bg-sky-700 px-5 py-3 font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:bg-slate-500"
              >
                {updatingId === task.assignmentId
                  ? "Lagrer …"
                  : task.status === "not_started"
                    ? "Start oppgaven"
                    : task.status === "in_progress"
                      ? "Marker som ferdig"
                      : "Åpne på nytt"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
