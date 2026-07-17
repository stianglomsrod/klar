"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUp,
  Clock3,
  Hand,
  LockKeyhole,
  RotateCcw,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  claimStudentHelpAction,
  closeTeacherHelpQueueAction,
  openTeacherHelpQueueAction,
  releaseStudentHelpAction,
  reorderStudentHelpAction,
  resolveStudentHelpAction,
  transferStudentHelpAction,
} from "@/app/actions/v3/help-actions";
import { createClientUuid } from "@/lib/client-uuid";
import { getHelpQueueTransitionAt } from "@/lib/help-queue-transition";
import type {
  HelpQueueMoveDirection,
  HelpQueuePriorityReason,
  TeacherHelpQueueItem,
  TeacherHelpQueueState,
} from "@/server/help/help-service";
import { restoreDialogFocus, trapDialogFocus } from "./dialog-focus";
import { useHelpQueueRealtime } from "./useHelpQueueRealtime";
import { redirectIfStaffAccessEnded } from "./staff-access-ended";

const timeFormatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
});

type QueueFocusTarget =
  | { kind: "heading" }
  | { kind: "action"; requestId: string }
  | { kind: "priority"; requestId: string }
  | { kind: "row"; requestId: string };

type QueueFocusRestore = {
  classId: string;
  target: QueueFocusTarget;
  baselineStateKey: string;
};

let pendingQueueFocus: QueueFocusRestore | null = null;

type RequestDialogState = {
  requestId: string;
  studentName: string;
};

const PRIORITY_REASON_LABELS: Record<HelpQueuePriorityReason, string> = {
  support_needed_now: "Trenger støtte nå",
  short_clarification: "Rask avklaring",
  staff_coordination: "Avtalt mellom ansatte",
};

function waitLabel(requestedAt: string, now: number): string {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(requestedAt).getTime()) / 60_000),
  );
  if (minutes < 1) return "Nettopp";
  return `${minutes} min`;
}

function waitDescription(requestedAt: string, now: number): string {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(requestedAt).getTime()) / 60_000),
  );
  if (minutes < 1) return "Ventet mindre enn ett minutt";
  return `Ventet i ${minutes} ${minutes === 1 ? "minutt" : "minutter"}`;
}

export function TeacherHelpQueue({
  classId,
  initialNow,
  state,
}: {
  classId: string;
  initialNow: string;
  state: TeacherHelpQueueState;
}) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => new Date(initialNow).getTime());
  const [priorityDialog, setPriorityDialog] =
    useState<RequestDialogState | null>(null);
  const [priorityReason, setPriorityReason] =
    useState<HelpQueuePriorityReason | "">("");
  const [transferDialog, setTransferDialog] =
    useState<RequestDialogState | null>(null);
  const [targetStaffAssignmentId, setTargetStaffAssignmentId] = useState("");
  const queueStateKey = state.queue
    ? [
        state.queue.id,
        state.queue.status,
        state.queue.lockVersion,
        state.queue.activityVersion,
      ].join(":")
    : "none";
  const commandIds = useRef(new Map<string, string>());
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const priorityDialogRef = useRef<HTMLDialogElement>(null);
  const transferDialogRef = useRef<HTMLDialogElement>(null);
  const priorityTriggerRef = useRef<HTMLElement | null>(null);
  const transferTriggerRef = useRef<HTMLElement | null>(null);
  const restorePriorityTrigger = useRef(true);
  const restoreTransferTrigger = useRef(true);
  useHelpQueueRealtime(
    classId,
    getHelpQueueTransitionAt(
      state.nextTransitionAt,
      state.currentSession?.endsAt ?? null,
    ),
  );

  useEffect(() => {
    if (state.requests.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [state.requests.length]);

  useEffect(() => {
    if (priorityDialog || transferDialog) return;
    const pending = pendingQueueFocus;
    if (
      !pending ||
      pending.classId !== classId ||
      pending.baselineStateKey === queueStateKey
    ) {
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (pendingQueueFocus !== pending) return;
        const target = pending.target;
        const element =
          target.kind === "heading"
            ? queueHeadingRef.current
            : document.querySelector<HTMLElement>(
                `[data-help-request-${target.kind}="${target.requestId}"]`,
              );
        const focusTarget = element ?? queueHeadingRef.current;
        focusTarget?.focus();
        if (document.activeElement === focusTarget) {
          pendingQueueFocus = null;
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [
    classId,
    priorityDialog,
    queueStateKey,
    state.queue?.activityVersion,
    state.requests.length,
    transferDialog,
  ]);

  useEffect(() => {
    if (priorityDialog && !priorityDialogRef.current?.open) {
      priorityDialogRef.current?.showModal();
    }
  }, [priorityDialog]);

  useEffect(() => {
    if (transferDialog && !transferDialogRef.current?.open) {
      transferDialogRef.current?.showModal();
    }
  }, [transferDialog]);

  useEffect(() => {
    if (
      targetStaffAssignmentId &&
      !state.transferTargets.some(
        (target) =>
          target.staffAssignmentId === targetStaffAssignmentId,
      )
    ) {
      setTargetStaffAssignmentId("");
    }
  }, [state.transferTargets, targetStaffAssignmentId]);

  async function mutate(
    key: string,
    action: (requestId: string) => Promise<{
      success: boolean;
      error?: string;
      accessEnded?: true;
    }>,
    focusTarget: QueueFocusTarget,
  ): Promise<boolean> {
    if (loadingKey) return false;
    setLoadingKey(key);
    setError(null);
    const requestId = commandIds.current.get(key) ?? createClientUuid();
    commandIds.current.set(key, requestId);
    // Realtime can refresh the server tree before the action response arrives.
    // Store the target first so that either that refresh or our explicit one
    // can restore keyboard focus after the mutation.
    pendingQueueFocus = {
      classId,
      target: focusTarget,
      baselineStateKey: queueStateKey,
    };
    try {
      const result = await action(requestId);
      if (!result.success) {
        pendingQueueFocus = null;
        if (redirectIfStaffAccessEnded(result, classId)) return false;
        const message = result.error ?? "Kunne ikke oppdatere hjelpekøen.";
        setError(message);
        if (
          message.startsWith("Køen ble endret") ||
          message.startsWith("Den ansatte har ikke lenger tilgang")
        ) {
          router.refresh();
        }
        return false;
      }
      commandIds.current.delete(key);
      router.refresh();
      return true;
    } catch {
      pendingQueueFocus = null;
      setError("Kunne ikke nå hjelpekøen akkurat nå. Prøv igjen.");
      return false;
    } finally {
      setLoadingKey(null);
    }
  }

  function openPriorityDialog(
    request: TeacherHelpQueueItem,
    trigger: HTMLElement,
  ) {
    priorityTriggerRef.current = trigger;
    restorePriorityTrigger.current = true;
    setPriorityReason("");
    setError(null);
    setPriorityDialog({
      requestId: request.id,
      studentName: request.studentName,
    });
  }

  function closePriorityDialog() {
    if (loadingKey) return;
    priorityDialogRef.current?.close();
  }

  function openTransferDialog(
    request: TeacherHelpQueueItem,
    trigger: HTMLElement,
  ) {
    transferTriggerRef.current = trigger;
    restoreTransferTrigger.current = true;
    setTargetStaffAssignmentId("");
    setError(null);
    setTransferDialog({
      requestId: request.id,
      studentName: request.studentName,
    });
  }

  function closeTransferDialog() {
    if (loadingKey) return;
    transferDialogRef.current?.close();
  }

  async function moveRequest(direction: HelpQueueMoveDirection) {
    if (
      !priorityDialog ||
      !priorityReason ||
      !state.queue ||
      state.queue.status === "closed"
    ) {
      return;
    }
    const request = state.requests.find(
      (item) => item.id === priorityDialog.requestId,
    );
    if (!request) return;
    const targetPosition =
      direction === "first"
        ? 1
        : direction === "up"
          ? Math.max(1, request.position - 1)
          : Math.min(state.requests.length, request.position + 1);
    const key = [
      "reorder",
      request.id,
      direction,
      priorityReason,
      state.queue.activityVersion,
    ].join(":");
    const success = await mutate(
      key,
      (commandRequestId) =>
        reorderStudentHelpAction(
          classId,
          state.queue!.id,
          request.id,
          direction,
          priorityReason,
          state.queue!.activityVersion,
          commandRequestId,
        ),
      { kind: "priority", requestId: request.id },
    );
    if (!success) return;
    setAnnouncement(
      `${request.studentName} er flyttet til plass ${targetPosition}.`,
    );
    restorePriorityTrigger.current = false;
    priorityDialogRef.current?.close();
  }

  async function transferRequest() {
    if (!transferDialog || !targetStaffAssignmentId) return;
    const request = state.requests.find(
      (item) => item.id === transferDialog.requestId,
    );
    const target = state.transferTargets.find(
      (item) => item.staffAssignmentId === targetStaffAssignmentId,
    );
    if (!request) return;
    if (!target) {
      setError("Velg en ansatt som fortsatt har tilgang til klassen.");
      return;
    }
    const key = [
      "transfer",
      request.id,
      request.ownershipVersion,
      targetStaffAssignmentId,
    ].join(":");
    const success = await mutate(
      key,
      (commandRequestId) =>
        transferStudentHelpAction(
          classId,
          request.id,
          request.ownershipVersion,
          targetStaffAssignmentId,
          commandRequestId,
        ),
      { kind: "row", requestId: request.id },
    );
    if (!success) return;
    setAnnouncement(`Hjelpen er overført til ${target.displayName}.`);
    restoreTransferTrigger.current = false;
    transferDialogRef.current?.close();
  }

  async function claimRequest(request: TeacherHelpQueueItem) {
    const key = ["claim", request.id, request.ownershipVersion].join(":");
    const success = await mutate(
      key,
      (commandRequestId) =>
        claimStudentHelpAction(
          classId,
          request.id,
          request.ownershipVersion,
          commandRequestId,
        ),
      { kind: "action", requestId: request.id },
    );
    if (success) setAnnouncement(`Du hjelper ${request.studentName}.`);
  }

  async function resolveRequest(request: TeacherHelpQueueItem) {
    const requestIndex = state.requests.findIndex(
      (item) => item.id === request.id,
    );
    const nextRequest =
      state.requests[requestIndex + 1] ??
      state.requests[requestIndex - 1] ??
      null;
    const key = ["resolve", request.id, request.ownershipVersion].join(":");
    const success = await mutate(
      key,
      (commandRequestId) =>
        resolveStudentHelpAction(
          classId,
          request.id,
          request.ownershipVersion,
          commandRequestId,
        ),
      nextRequest
        ? { kind: "row", requestId: nextRequest.id }
        : { kind: "heading" },
    );
    if (success) setAnnouncement(`${request.studentName} er ferdig hjulpet.`);
  }

  async function releaseRequest(request: TeacherHelpQueueItem) {
    const key = ["release", request.id, request.ownershipVersion].join(":");
    const success = await mutate(
      key,
      (commandRequestId) =>
        releaseStudentHelpAction(
          classId,
          request.id,
          request.ownershipVersion,
          commandRequestId,
        ),
      { kind: "row", requestId: request.id },
    );
    if (success) {
      setAnnouncement(`${request.studentName} er frigitt til køen.`);
    }
  }

  const queueOpen = state.queue?.status === "open";
  const queueClosing = state.queue?.status === "closing";
  const queueClosed = state.queue?.status === "closed";
  const session = state.currentSession;
  const waitingCount = state.requests.filter(
    (request) => request.status === "waiting",
  ).length;
  const claimedCount = state.requests.length - waitingCount;
  const priorityRequest = priorityDialog
    ? state.requests.find((request) => request.id === priorityDialog.requestId) ?? null
    : null;
  const transferRequestState = transferDialog
    ? state.requests.find((request) => request.id === transferDialog.requestId) ?? null
    : null;
  const selectedTransferTarget = state.transferTargets.find(
    (target) => target.staffAssignmentId === targetStaffAssignmentId,
  );

  return (
    <>
    <section
      aria-labelledby="queue-heading"
      className="mt-8 overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 bg-indigo-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              ref={queueHeadingRef}
              id="queue-heading"
              tabIndex={-1}
              className="scroll-mt-24 text-2xl font-black text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              Hjelpekø
            </h2>
            {state.queue && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  queueOpen
                    ? "bg-emerald-100 text-emerald-900"
                    : queueClosing
                      ? "bg-amber-100 text-amber-950"
                      : "bg-slate-200 text-slate-800"
                }`}
              >
                {queueOpen ? "Åpen" : queueClosing ? "Stenger" : "Stengt"}
              </span>
            )}
          </div>
          {session ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700">
              <strong>{session.title}</strong>
              <span aria-hidden="true">·</span>
              <span>
                {timeFormatter.format(new Date(session.startsAt))}–
                {timeFormatter.format(new Date(session.endsAt))}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-slate-700">Ingen undervisningsøkt pågår nå.</p>
          )}
        </div>

        {!state.queue && session && (
          <button
            type="button"
            onClick={() =>
              void mutate(
                `open:${session.id}`,
                (requestId) =>
                  openTeacherHelpQueueAction(classId, session.id, requestId),
                { kind: "heading" },
              )
            }
            disabled={Boolean(loadingKey)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-5 py-3 font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
          >
            <Hand aria-hidden="true" className="h-5 w-5" />
            {loadingKey === `open:${session.id}` ? "Åpner …" : "Åpne kø"}
          </button>
        )}
        {queueOpen && state.queue && (
          <button
            type="button"
            onClick={() =>
              void mutate(
                `close:${state.queue!.id}:${state.queue!.lockVersion}`,
                (requestId) =>
                  closeTeacherHelpQueueAction(
                    classId,
                    state.queue!.id,
                    state.queue!.lockVersion,
                    requestId,
                  ),
                { kind: "heading" },
              )
            }
            disabled={Boolean(loadingKey)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-indigo-300 bg-white px-5 py-3 font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:text-slate-500"
          >
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            {loadingKey ===
            `close:${state.queue.id}:${state.queue.lockVersion}`
              ? "Stenger …"
              : "Steng kø"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-5 rounded-2xl bg-red-50 p-4 text-red-800 sm:mx-6">
          {error}
        </p>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {state.queue
          ? `${state.queue.status === "open" ? "Hjelpekøen er åpen" : state.queue.status === "closing" ? "Hjelpekøen stenger" : "Hjelpekøen er stengt"}. ${waitingCount} ${waitingCount === 1 ? "elev venter" : "elever venter"}. ${claimedCount} ${claimedCount === 1 ? "elev blir hjulpet" : "elever blir hjulpet"}.`
          : "Hjelpekøen er stengt."}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <div className="p-5 sm:p-6">
        {queueClosed ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">
            Køen er stengt for denne undervisningsøkten.
          </p>
        ) : !state.queue ? (
          <p className="text-slate-600">
            {session
              ? "Åpne køen når elevene skal kunne rekke opp hånden."
              : "Køen kan åpnes når en planlagt økt er i gang."}
          </p>
        ) : state.requests.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">
            {queueClosing ? "Køen er ferdig og lukkes nå." : "Ingen venter på hjelp."}
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="font-bold text-slate-700">
                {state.requests.length} {state.requests.length === 1 ? "elev" : "elever"}
              </p>
              {queueClosing && (
                <p className="text-sm font-semibold text-amber-900">
                  Ingen nye kan stille seg i kø
                </p>
              )}
            </div>
            <ol className="space-y-3" aria-label="Intern kørekkefølge">
              {state.requests.map((request) => (
                <li
                  key={request.id}
                  data-help-request-row={request.id}
                  tabIndex={-1}
                  className="scroll-mt-24 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(16rem,auto)] lg:items-center"
                >
                  <span
                    aria-label={`Køplass ${request.position}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-black text-indigo-900"
                  >
                    {request.position}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">{request.studentName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Clock3 aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">
                          {waitDescription(request.requestedAt, now)}
                        </span>
                        <span aria-hidden="true">
                          {waitLabel(request.requestedAt, now)}
                        </span>
                      </span>
                      {request.taskTitle && (
                        <span>
                          {request.taskSubject ? `${request.taskSubject}: ` : ""}
                          {request.taskTitle}
                        </span>
                      )}
                      {request.claimedByName && (
                        <span className="font-semibold">
                          Hos {request.claimedByCurrentTeacher ? "deg" : request.claimedByName}
                        </span>
                      )}
                    </div>
                    {request.priority && (
                      <p className="mt-2 text-xs font-semibold text-indigo-800">
                        Prioritert av {request.priority.changedByName} kl. {timeFormatter.format(new Date(request.priority.changedAt))}: {PRIORITY_REASON_LABELS[request.priority.reasonCode]}
                      </p>
                    )}
                  </div>
                  <div className="grid w-full gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
                    {request.status === "waiting" && (
                      <button
                        type="button"
                        onClick={() => void claimRequest(request)}
                        disabled={Boolean(loadingKey)}
                        data-help-request-action={request.id}
                        data-help-claim={request.id}
                        aria-label={`Jeg tar denne – ${request.studentName}`}
                        className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2.5 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
                      >
                        {loadingKey === `claim:${request.id}:${request.ownershipVersion}` ? "Tar …" : "Jeg tar denne"}
                      </button>
                    )}
                    {request.status === "claimed" && request.claimedByCurrentTeacher && (
                      <>
                        <button
                          type="button"
                          onClick={() => void resolveRequest(request)}
                          disabled={Boolean(loadingKey)}
                          data-help-request-action={request.id}
                          data-help-resolve={request.id}
                          aria-label={`Ferdig hjulpet – ${request.studentName}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:bg-slate-500"
                        >
                          <Check aria-hidden="true" className="h-5 w-5" />
                          {loadingKey === `resolve:${request.id}:${request.ownershipVersion}` ? "Lagrer …" : "Ferdig hjulpet"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void releaseRequest(request)}
                          disabled={Boolean(loadingKey)}
                          data-help-release={request.id}
                          aria-label={`Frigi – ${request.studentName}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:text-slate-400"
                        >
                          <RotateCcw aria-hidden="true" className="h-4 w-4" />
                          {loadingKey === `release:${request.id}:${request.ownershipVersion}` ? "Frigir …" : "Frigi"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) =>
                            openTransferDialog(request, event.currentTarget)
                          }
                          disabled={Boolean(loadingKey)}
                          data-help-transfer={request.id}
                          aria-label={`Overfør – ${request.studentName}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:text-slate-400"
                        >
                          <Send aria-hidden="true" className="h-4 w-4" />
                          Overfør
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(event) =>
                        openPriorityDialog(request, event.currentTarget)
                      }
                      disabled={Boolean(loadingKey)}
                      data-help-request-priority={request.id}
                      aria-label={`Endre prioritet – ${request.studentName}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:text-slate-400"
                    >
                      <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                      Endre prioritet
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>

    <dialog
      ref={priorityDialogRef}
      className="staff-dialog staff-dialog--help-queue rounded-2xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
      aria-labelledby="help-priority-title"
      aria-describedby="help-priority-description"
      onCancel={(event) => {
        if (loadingKey) {
          event.preventDefault();
          return;
        }
        setError(null);
      }}
      onClose={() => {
        setPriorityDialog(null);
        setPriorityReason("");
        setError(null);
        if (restorePriorityTrigger.current) {
          restoreDialogFocus(priorityTriggerRef.current);
        }
        restorePriorityTrigger.current = true;
      }}
      onKeyDown={trapDialogFocus}
    >
      <div className="staff-dialog__content">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="help-priority-title" className="text-xl font-black">
              Endre prioritet
            </h2>
            <p id="help-priority-description" className="mt-1 text-sm leading-6 text-slate-600">
              Velg en intern grunn før du flytter {priorityDialog?.studentName ?? "eleven"}.
            </p>
          </div>
          <button
            type="button"
            onClick={closePriorityDialog}
            disabled={Boolean(loadingKey)}
            aria-label="Lukk"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:text-slate-400"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="staff-dialog__scroll space-y-5 px-5 py-5 sm:px-6">
          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </p>
          )}
          <fieldset>
            <legend className="font-black">Grunn</legend>
            <div className="mt-3 grid gap-3">
              {(Object.entries(PRIORITY_REASON_LABELS) as [
                HelpQueuePriorityReason,
                string,
              ][]).map(([value, label], index) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="help-priority-reason"
                    value={value}
                    checked={priorityReason === value}
                    onChange={() => setPriorityReason(value)}
                    autoFocus={index === 0}
                    className="h-5 w-5 accent-indigo-700"
                  />
                  <span className="font-semibold">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {priorityRequest?.priority && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              Sist endret av {priorityRequest.priority.changedByName} kl. {timeFormatter.format(new Date(priorityRequest.priority.changedAt))}: {PRIORITY_REASON_LABELS[priorityRequest.priority.reasonCode]}.
            </p>
          )}
        </div>
        <footer className="grid gap-3 border-t border-slate-200 px-5 py-4 sm:grid-cols-4 sm:px-6">
          <button
            type="button"
            onClick={closePriorityDialog}
            disabled={Boolean(loadingKey)}
            className="min-h-11 rounded-xl px-4 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:text-slate-400"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => void moveRequest("first")}
            disabled={
              Boolean(loadingKey) ||
              !priorityReason ||
              !priorityRequest ||
              priorityRequest.position === 1
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
          >
            <ChevronsUp aria-hidden="true" className="h-4 w-4" />
            Flytt først
          </button>
          <button
            type="button"
            onClick={() => void moveRequest("up")}
            disabled={
              Boolean(loadingKey) ||
              !priorityReason ||
              !priorityRequest ||
              priorityRequest.position === 1
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
          >
            <ArrowUp aria-hidden="true" className="h-4 w-4" />
            Flytt opp
          </button>
          <button
            type="button"
            onClick={() => void moveRequest("down")}
            disabled={
              Boolean(loadingKey) ||
              !priorityReason ||
              !priorityRequest ||
              priorityRequest.position === state.requests.length
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
          >
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
            Flytt ned
          </button>
        </footer>
      </div>
    </dialog>

    <dialog
      ref={transferDialogRef}
      className="staff-dialog staff-dialog--help-queue rounded-2xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
      aria-labelledby="help-transfer-title"
      aria-describedby="help-transfer-description"
      onCancel={(event) => {
        if (loadingKey) {
          event.preventDefault();
          return;
        }
        setError(null);
      }}
      onClose={() => {
        setTransferDialog(null);
        setTargetStaffAssignmentId("");
        setError(null);
        if (restoreTransferTrigger.current) {
          restoreDialogFocus(transferTriggerRef.current);
        }
        restoreTransferTrigger.current = true;
      }}
      onKeyDown={trapDialogFocus}
    >
      <form
        className="staff-dialog__content"
        onSubmit={(event) => {
          event.preventDefault();
          void transferRequest();
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="help-transfer-title" className="text-xl font-black">
              Overfør hjelp
            </h2>
            <p id="help-transfer-description" className="mt-1 text-sm leading-6 text-slate-600">
              Velg hvem som skal hjelpe {transferDialog?.studentName ?? "eleven"}.
            </p>
          </div>
          <button
            type="button"
            onClick={closeTransferDialog}
            disabled={Boolean(loadingKey)}
            aria-label="Lukk"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:text-slate-400"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="staff-dialog__scroll space-y-5 px-5 py-5 sm:px-6">
          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </p>
          )}
          {state.transferTargets.length > 0 ? (
            <div>
              <label htmlFor="help-transfer-target" className="font-black">
                Ansatt
              </label>
              <select
                id="help-transfer-target"
                value={targetStaffAssignmentId}
                onChange={(event) =>
                  setTargetStaffAssignmentId(event.target.value)
                }
                required
                autoFocus
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="">Velg ansatt</option>
                {state.transferTargets.map((target) => (
                  <option
                    key={target.staffAssignmentId}
                    value={target.staffAssignmentId}
                  >
                    {target.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-700">
              Ingen andre ansatte med aktiv tilgang.
            </p>
          )}
          {transferRequestState && (
            <p className="text-sm text-slate-600">
              Plass {transferRequestState.position} og oppgavekonteksten beholdes.
            </p>
          )}
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={closeTransferDialog}
            disabled={Boolean(loadingKey)}
            className="min-h-11 rounded-xl px-4 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:text-slate-400"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={Boolean(loadingKey) || !selectedTransferTarget}
            className="min-h-11 rounded-xl bg-indigo-700 px-5 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
          >
            {loadingKey?.startsWith(`transfer:${transferDialog?.requestId}:`)
              ? "Overfører …"
              : "Overfør"}
          </button>
        </footer>
      </form>
    </dialog>
    </>
  );
}
