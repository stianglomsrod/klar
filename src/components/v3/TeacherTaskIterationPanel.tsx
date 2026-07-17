"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CopyPlus, MoveRight, Users, X } from "lucide-react";
import {
  moveTaskIterationAction,
  reissueTaskIterationAction,
} from "@/app/actions/v3/task-iteration-actions";
import { createClientUuid } from "@/lib/client-uuid";
import { formatRecipientPreview } from "@/lib/task-iteration-copy";
import type {
  TaskIterationRecipientSummary,
  TaskIterationTargetSession,
  TaskScheduleInput,
  ScheduledSessionSummary,
  TeacherTaskIterationSummary,
  TeacherTaskIterationWorkspace,
} from "@/server/tasks/task-iteration-service";
import { restoreDialogFocus, trapDialogFocus } from "./dialog-focus";

type ScheduleChoice = "move" | "reissue" | "";

const dateTimeFormatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const STATUS_LABELS = {
  assigned: "Ikke ferdig",
  completed: "Ferdig",
  reopened: "Åpnet igjen",
} as const;

function formatSession(session: ScheduledSessionSummary): string {
  return `${dateTimeFormatter.format(new Date(session.startsAt))} – ${session.title}`;
}

function recipientUnavailableReason(
  recipient: TaskIterationRecipientSummary,
  choice: ScheduleChoice,
  target: TaskIterationTargetSession | null,
): string | null {
  if (choice === "move" && recipient.status === "completed") {
    return "Ferdige oppgaver kan ikke flyttes. Velg «Send ut på nytt».";
  }
  if (!target) return null;
  if (
    Date.parse(target.startsAt) <=
    Date.parse(recipient.scheduledSession.startsAt)
  ) {
    return "Velg en undervisningsøkt som er senere enn dagens økt.";
  }
  if (
    recipient.blockedTargetTeachingSessionIds.includes(
      target.teachingSessionId,
    )
  ) {
    return "Eleven har allerede denne oppgaven i den valgte økten.";
  }
  return null;
}

export function TeacherTaskIterationPanel({
  classId,
  workspace,
}: {
  classId: string;
  workspace: TeacherTaskIterationWorkspace;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const initialDialogFocusRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const [activeIterationId, setActiveIterationId] = useState<string | null>(null);
  const [choice, setChoice] = useState<ScheduleChoice>("");
  const [targetRevisionSessionId, setTargetRevisionSessionId] = useState("");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const activeIteration =
    workspace.iterations.find(
      (iteration) => iteration.id === activeIterationId,
    ) ?? null;
  const targetSession =
    workspace.targetSessions.find(
      (session) => session.revisionSessionId === targetRevisionSessionId,
    ) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !activeIterationId || dialog.open) return;
    dialog.showModal();
    initialDialogFocusRef.current?.focus({ preventScroll: true });
  }, [activeIterationId]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const selectedRecipients = useMemo(() => {
    if (!activeIteration) return [];
    const selected = new Set(selectedAssignmentIds);
    return activeIteration.recipients
      .filter((recipient) => selected.has(recipient.assignmentId))
      .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
  }, [activeIteration, selectedAssignmentIds]);
  const targetSessionGroups = useMemo(() => {
    const groups = new Map<string, TaskIterationTargetSession[]>();
    for (const session of workspace.targetSessions) {
      const day = dayFormatter.format(new Date(session.startsAt));
      const values = groups.get(day) ?? [];
      values.push(session);
      groups.set(day, values);
    }
    return [...groups.entries()];
  }, [workspace.targetSessions]);

  function resetDialogState() {
    setChoice("");
    setTargetRevisionSessionId("");
    setSelectedAssignmentIds([]);
    setError(null);
    setLoading(false);
  }

  function openDialog(
    iteration: TeacherTaskIterationSummary,
    trigger: HTMLButtonElement,
  ) {
    triggerRef.current = trigger;
    setStatus(null);
    resetDialogState();
    setActiveIterationId(iteration.id);
  }

  function closeDialog() {
    if (loading) return;
    dialogRef.current?.close();
  }

  function changeChoice(nextChoice: Exclude<ScheduleChoice, "">) {
    setChoice(nextChoice);
    setTargetRevisionSessionId("");
    setSelectedAssignmentIds([]);
    setError(null);
  }

  function changeTarget(revisionSessionId: string) {
    setTargetRevisionSessionId(revisionSessionId);
    setSelectedAssignmentIds([]);
    setError(null);
  }

  function toggleRecipient(assignmentId: string, checked: boolean) {
    setSelectedAssignmentIds((current) =>
      checked
        ? [...current, assignmentId]
        : current.filter((id) => id !== assignmentId),
    );
    setError(null);
  }

  async function submit() {
    if (
      !activeIteration ||
      !targetSession ||
      !choice ||
      selectedRecipients.length === 0 ||
      loading
    ) {
      setError("Velg handling, undervisningsøkt og minst én elev.");
      return;
    }
    const invalidRecipient = selectedRecipients.find((recipient) =>
      recipientUnavailableReason(recipient, choice, targetSession),
    );
    if (invalidRecipient) {
      setError(
        recipientUnavailableReason(invalidRecipient, choice, targetSession) ??
          "Mottakerlisten må kontrolleres på nytt.",
      );
      return;
    }

    const fingerprint = JSON.stringify({
      choice,
      iterationId: activeIteration.id,
      iterationVersion: activeIteration.managementVersion,
      targetRevisionSessionId: targetSession.revisionSessionId,
      targetPlanLockVersion: targetSession.planLockVersion,
      recipients: selectedRecipients.map((recipient) => ({
        assignmentId: recipient.assignmentId,
        stateVersion: recipient.stateVersion,
        scheduleVersion: recipient.scheduleVersion,
      })),
    });
    const requestId = requestIds.current.get(fingerprint) ?? createClientUuid();
    requestIds.current.set(fingerprint, requestId);
    const input: TaskScheduleInput = {
      classId,
      iterationId: activeIteration.id,
      targetRevisionSessionId: targetSession.revisionSessionId,
      expectedIterationVersion: activeIteration.managementVersion,
      expectedTargetPlanLockVersion: targetSession.planLockVersion,
      recipients: selectedRecipients.map((recipient) => ({
        assignmentId: recipient.assignmentId,
        expectedStateVersion: recipient.stateVersion,
        expectedScheduleVersion: recipient.scheduleVersion,
      })),
      requestId,
    };

    setLoading(true);
    setError(null);
    try {
      const result =
        choice === "move"
          ? await moveTaskIterationAction(input)
          : await reissueTaskIterationAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      requestIds.current.delete(fingerprint);
      setStatus(
        choice === "move"
          ? `Oppgaven er flyttet for ${selectedRecipients.length} ${selectedRecipients.length === 1 ? "elev" : "elever"}.`
          : `Oppgaven er sendt ut på nytt til ${selectedRecipients.length} ${selectedRecipients.length === 1 ? "elev" : "elever"}.`,
      );
      dialogRef.current?.close();
      router.refresh();
    } catch {
      setError("Kunne ikke lagre akkurat nå. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="task-iterations-heading"
      className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-700">
            Utsendinger
          </p>
          <h2 id="task-iterations-heading" className="mt-1 text-2xl font-black">
            Publiserte oppgaver
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Se hvilken undervisningsøkt oppgaven hører til. Flytt samme oppgave,
            eller send samme innhold ut på nytt.
          </p>
        </div>
        <p className="font-semibold text-slate-600">
          {workspace.iterations.length} {workspace.iterations.length === 1 ? "utsending" : "utsendinger"}
        </p>
      </div>

      <p
        role="status"
        aria-atomic="true"
        className={
          status
            ? "mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 font-semibold text-emerald-950"
            : "sr-only"
        }
      >
        {status ?? ""}
      </p>

      {workspace.iterations.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-slate-600">
          Ingen oppgaver er sendt ut fra en ukeplan ennå.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4">
          {workspace.iterations.map((iteration) => {
            const sessionGroups = new Map<string, TaskIterationRecipientSummary[]>();
            for (const recipient of iteration.recipients) {
              const group =
                sessionGroups.get(recipient.scheduledSession.revisionSessionId) ?? [];
              group.push(recipient);
              sessionGroups.set(recipient.scheduledSession.revisionSessionId, group);
            }
            return (
              <li key={iteration.id}>
                <article
                  aria-label={`${iteration.title}, utsending ${iteration.iterationNumber}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">{iteration.title}</h3>
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-900">
                          Utsending {iteration.iterationNumber}
                        </span>
                      </div>
                      {iteration.subject && (
                        <p className="mt-1 font-semibold text-slate-600">
                          {iteration.subject}
                        </p>
                      )}
                      <div className="mt-3 grid gap-3 text-sm text-slate-700">
                        {[...sessionGroups.values()].map((recipients) => {
                          const session = recipients[0].scheduledSession;
                          return (
                            <div key={session.revisionSessionId}>
                              <p className="flex flex-wrap items-center gap-2">
                                <CalendarClock aria-hidden="true" className="h-4 w-4 text-indigo-700" />
                                <span className="font-semibold">{formatSession(session)}</span>
                                <span>· {recipients.length} {recipients.length === 1 ? "elev" : "elever"}</span>
                              </p>
                              <ul
                                aria-label={`Mottakere i ${session.title}`}
                                className="mt-2 flex flex-wrap gap-2"
                              >
                                {recipients.map((recipient) => (
                                  <li
                                    key={recipient.assignmentId}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5"
                                  >
                                    <span className="font-bold">{recipient.studentName}</span>
                                    <span className="text-slate-600"> · {STATUS_LABELS[recipient.status]}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => openDialog(iteration, event.currentTarget)}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    >
                      <CalendarClock aria-hidden="true" className="h-5 w-5" />
                      Flytt eller send ut på nytt
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        className="staff-dialog staff-dialog--task-iteration rounded-2xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        aria-labelledby="task-schedule-dialog-title"
        aria-describedby="task-schedule-dialog-description"
        onCancel={(event) => {
          if (loading) event.preventDefault();
        }}
        onClose={() => {
          setActiveIterationId(null);
          resetDialogState();
          restoreDialogFocus(triggerRef.current);
        }}
        onKeyDown={trapDialogFocus}
      >
        <div className="staff-dialog__content">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 id="task-schedule-dialog-title" className="text-xl font-black">
                Flytt eller send ut på nytt {activeIteration?.title ?? "oppgaven"}
              </h2>
              <p id="task-schedule-dialog-description" className="mt-1 text-sm leading-6 text-slate-600">
                Velg hva som skal skje, ny undervisningsøkt og hvilke elever det gjelder.
              </p>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              disabled={loading}
              aria-label="Lukk"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:text-slate-400"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="staff-dialog__scroll space-y-6 px-5 py-5 sm:px-6">
            {error && (
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-950 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                {error}
              </div>
            )}

            <fieldset disabled={loading}>
              <legend className="text-lg font-black">Hva vil du gjøre?</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-28 cursor-pointer gap-3 rounded-2xl border border-slate-300 p-4 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                  <input
                    ref={initialDialogFocusRef}
                    type="radio"
                    name="task-schedule-choice"
                    value="move"
                    checked={choice === "move"}
                    onChange={() => changeChoice("move")}
                    className="mt-1 h-5 w-5 shrink-0 accent-indigo-700"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-black">
                      <MoveRight aria-hidden="true" className="h-5 w-5" />
                      Flytt samme oppgave
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">
                      Beholder status og poenghistorikk. Ingen ny poengmulighet.
                    </span>
                  </span>
                </label>
                <label className="flex min-h-28 cursor-pointer gap-3 rounded-2xl border border-slate-300 p-4 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                  <input
                    type="radio"
                    name="task-schedule-choice"
                    value="reissue"
                    checked={choice === "reissue"}
                    onChange={() => changeChoice("reissue")}
                    className="mt-1 h-5 w-5 shrink-0 accent-indigo-700"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-black">
                      <CopyPlus aria-hidden="true" className="h-5 w-5" />
                      Send ut på nytt
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">
                      Lager en ny oppgave. Eleven kan få poeng på nytt. Den gamle beholdes.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div>
              <label htmlFor="task-schedule-target" className="text-lg font-black">
                Ny undervisningsøkt
              </label>
              <select
                id="task-schedule-target"
                value={targetRevisionSessionId}
                onChange={(event) => changeTarget(event.target.value)}
                disabled={!choice || loading}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:bg-slate-100"
              >
                <option value="">Velg undervisningsøkt</option>
                {targetSessionGroups.map(([day, sessions]) => (
                  <optgroup key={day} label={day}>
                    {sessions.map((session) => (
                      <option key={session.revisionSessionId} value={session.revisionSessionId}>
                        {formatSession(session)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {workspace.targetSessions.length === 0 && (
                <p className="mt-2 text-sm text-slate-600">
                  Publiser en framtidig undervisningsøkt før oppgaven kan flyttes eller sendes ut på nytt.
                </p>
              )}
            </div>

            <fieldset disabled={!choice || !targetSession || loading}>
              <legend className="flex items-center gap-2 text-lg font-black">
                <Users aria-hidden="true" className="h-5 w-5" />
                Velg elever
              </legend>
              <p className="mt-1 text-sm text-slate-600">
                Ingen elever velges automatisk.
              </p>
              <div className="mt-3 grid gap-3">
                {activeIteration?.recipients.map((recipient) => {
                  const unavailable = recipientUnavailableReason(
                    recipient,
                    choice,
                    targetSession,
                  );
                  return (
                    <label
                      key={recipient.assignmentId}
                      className={`flex min-h-11 gap-3 rounded-xl border p-3 ${unavailable ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500" : "cursor-pointer border-slate-300 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssignmentIds.includes(recipient.assignmentId)}
                        onChange={(event) =>
                          toggleRecipient(recipient.assignmentId, event.target.checked)
                        }
                        disabled={Boolean(unavailable)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-700"
                      />
                      <span className="min-w-0">
                        <span className="font-bold">{recipient.studentName}</span>
                        <span className="ml-2 text-sm">
                          {STATUS_LABELS[recipient.status]}
                        </span>
                        <span className="mt-1 block text-sm">
                          Nå: {dateTimeFormatter.format(new Date(recipient.scheduledSession.startsAt))}
                        </span>
                        {unavailable && (
                          <span className="mt-1 block text-sm font-semibold text-slate-700">
                            {unavailable}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

          </div>

          <footer className="flex flex-wrap items-end justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
            {choice && targetSession && selectedRecipients.length > 0 && (
              <section
                aria-labelledby="task-schedule-summary"
                className="mr-auto min-w-0 basis-full rounded-xl bg-indigo-50 px-3 py-2 lg:max-w-[30rem] lg:basis-auto"
              >
                <h3 id="task-schedule-summary" className="text-sm font-black">
                  Kontroller valget
                </h3>
                <p className="mt-1 text-sm leading-5 text-slate-800">
                  <strong>
                    {choice === "move" ? "Flytt samme oppgave" : "Send ut på nytt"}:
                  </strong>{" "}
                  {activeIteration?.title ?? "Oppgaven"} for {selectedRecipients.length}{" "}
                  {selectedRecipients.length === 1 ? "elev" : "elever"} til {formatSession(targetSession)}.
                </p>
                <p className="mt-1 break-words text-xs leading-4 text-slate-700">
                  Valgt: {formatRecipientPreview(
                    selectedRecipients.map((recipient) => recipient.studentName),
                  )}.
                </p>
              </section>
            )}
            <button
              type="button"
              onClick={closeDialog}
              disabled={loading}
              className="min-h-11 rounded-xl px-4 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:text-slate-400"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                loading ||
                !choice ||
                !targetSession ||
                selectedRecipients.length === 0
              }
              className="min-h-11 rounded-xl bg-indigo-700 px-5 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
            >
              {loading
                ? "Lagrer …"
                : choice === "move"
                  ? "Flytt oppgaven"
                  : choice === "reissue"
                    ? "Send ut på nytt"
                    : "Velg handling"}
            </button>
          </footer>
        </div>
      </dialog>
    </section>
  );
}
