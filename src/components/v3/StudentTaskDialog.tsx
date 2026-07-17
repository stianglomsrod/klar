"use client";

import { useEffect, useRef } from "react";
import {
  Check,
  CircleCheckBig,
  Clock3,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { StudentTodayTask } from "@/server/tasks/task-service";
import type { StudentExperience } from "@/server/students/experience-service";
import type { StudentHelpState } from "@/server/help/help-service";
import { restoreDialogFocus, trapDialogFocus } from "./dialog-focus";
import { StudentReadAloudButton } from "./StudentReadAloudButton";
import { StudentHelpControl } from "./StudentHelpControl";

export type StudentTaskDialogMode = "task" | "checkpoint";

export function StudentTaskDialog({
  task,
  mode,
  returnFocusTarget,
  experience,
  isUpdating,
  hasPendingMutation,
  error,
  helpState,
  showHelpControl,
  onClose,
  onShowCheckpoint,
  onCancelCheckpoint,
  onComplete,
  onUndo,
}: {
  task: StudentTodayTask | null;
  mode: StudentTaskDialogMode;
  returnFocusTarget: HTMLElement | null;
  experience: StudentExperience;
  isUpdating: boolean;
  hasPendingMutation: boolean;
  error: string | null;
  helpState: StudentHelpState;
  showHelpControl: boolean;
  onClose: () => void;
  onShowCheckpoint: () => void;
  onCancelCheckpoint: () => void;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const checkpointTitleRef = useRef<HTMLHeadingElement>(null);
  const completeButtonRef = useRef<HTMLButtonElement>(null);
  const previousModeRef = useRef<StudentTaskDialogMode>(mode);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (task && !dialog.open) {
      returnFocusRef.current =
        returnFocusTarget ?? (document.activeElement as HTMLElement | null);
      dialog.showModal();
    } else if (!task && dialog.open) {
      dialog.close();
    }
  }, [returnFocusTarget, task]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!task) {
      previousModeRef.current = mode;
      return;
    }
    if (!dialog?.open) return;

    if (
      mode === "checkpoint" &&
      previousModeRef.current !== "checkpoint"
    ) {
      checkpointTitleRef.current?.focus();
    } else if (previousModeRef.current === "checkpoint") {
      completeButtonRef.current?.focus();
    }
    previousModeRef.current = mode;
  }, [mode, task]);

  function handleNativeClose() {
    restoreDialogFocus(returnFocusRef.current);
  }

  function requestClose() {
    onClose();
  }

  const supportLevel = task
    ? Math.min(task.supportLevel, experience.supportLevel)
    : 1;
  const readAloudText = task
    ? [task.title, supportLevel >= 2 ? task.description : null]
        .filter(Boolean)
        .join(". ")
    : "";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="student-task-dialog-title"
      className="student-task-dialog"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={handleNativeClose}
      onKeyDown={trapDialogFocus}
    >
      {task && (
        <div className="student-task-dialog__content">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-700">
                {task.subject ?? "Oppgave"}
              </p>
              <h2
                id="student-task-dialog-title"
                ref={checkpointTitleRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
              >
                {mode === "checkpoint" ? "Er du ferdig?" : task.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={hasPendingMutation}
              aria-label="Lukk oppgaven"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <X aria-hidden="true" className="h-6 w-6" />
            </button>
          </header>

          {mode === "task" ? (
            <>
              <div className="student-task-dialog__scroll px-5 py-6 sm:px-7">
                {task.status === "reopened" && (
                  <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                    <p className="font-bold">Oppgaven er åpnet igjen</p>
                    <p className="mt-1 leading-6">
                      {task.reopenMessage ??
                        "Du kan jobbe litt videre og fullføre på nytt når du er klar."}
                    </p>
                  </div>
                )}

                <div className="rounded-3xl bg-indigo-50 p-5 sm:p-6">
                  {supportLevel >= 2 && task.description ? (
                    <p className="text-lg leading-8 text-slate-800">
                      {task.description}
                    </p>
                  ) : (
                    <p className="text-lg font-semibold text-slate-800">
                      Se på oppgaven læreren har gitt deg.
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <StudentReadAloudButton text={readAloudText} />
                    {supportLevel >= 3 && task.estimatedMinutes && (
                      <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-700">
                        <Clock3 aria-hidden="true" className="h-5 w-5" />
                        Omtrent {task.estimatedMinutes} min
                      </span>
                    )}
                  </div>
                </div>

                {experience.progressEnabled && task.status !== "completed" && (
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">
                    <Sparkles aria-hidden="true" className="h-4 w-4" />
                    {task.pointsValue} poeng når oppgaven er ferdig
                  </p>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
                  >
                    {error}
                  </p>
                )}
              </div>

              <footer className="student-task-dialog__footer flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                {showHelpControl && (
                  <StudentHelpControl
                    state={helpState}
                    taskAssignmentId={task.assignmentId}
                    cancelPresentation="inline"
                  />
                )}
                {task.status === "completed" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasPendingMutation) onUndo();
                    }}
                    aria-disabled={hasPendingMutation}
                    aria-busy={isUpdating}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 aria-disabled:bg-slate-100 aria-disabled:text-slate-500"
                  >
                    <RotateCcw aria-hidden="true" className="h-5 w-5" />
                    {isUpdating ? "Lagrer …" : "Angre fullføring"}
                  </button>
                ) : (
                  <button
                    ref={completeButtonRef}
                    type="button"
                    onClick={onShowCheckpoint}
                    disabled={hasPendingMutation}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-7 py-3 font-black text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
                  >
                    <Check aria-hidden="true" className="h-5 w-5" />
                    Fullfør
                  </button>
                )}
              </footer>
            </>
          ) : (
            <>
              <div className="student-task-dialog__scroll flex flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CircleCheckBig aria-hidden="true" className="h-9 w-9" />
                </span>
                <p className="mt-5 max-w-md text-lg leading-7 text-slate-700">
                  Bekreft når du er ferdig med <strong>{task.title}</strong>.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Du kan angre etterpå hvis du trykket feil.
                </p>
                {error && (
                  <p
                    role="alert"
                    className="mt-5 w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-red-800"
                  >
                    {error}
                  </p>
                )}
              </div>

              <footer className="student-task-dialog__footer grid gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:grid-cols-2 sm:px-7">
                <button
                  type="button"
                  onClick={onCancelCheckpoint}
                  disabled={hasPendingMutation}
                  className="min-h-12 rounded-2xl bg-slate-100 px-6 py-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:text-slate-500"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasPendingMutation) onComplete();
                  }}
                  aria-disabled={hasPendingMutation}
                  aria-busy={isUpdating}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-7 py-3 font-black text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 aria-disabled:bg-slate-500"
                >
                  <Check aria-hidden="true" className="h-5 w-5" />
                  {isUpdating ? "Lagrer …" : "Ferdig"}
                </button>
              </footer>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
