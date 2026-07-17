"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Hand, LockKeyhole } from "lucide-react";
import {
  claimStudentHelpAction,
  closeTeacherHelpQueueAction,
  openTeacherHelpQueueAction,
  resolveStudentHelpAction,
} from "@/app/actions/v3/help-actions";
import { createClientUuid } from "@/lib/client-uuid";
import { getHelpQueueTransitionAt } from "@/lib/help-queue-transition";
import type { TeacherHelpQueueState } from "@/server/help/help-service";
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
  | { kind: "row"; requestId: string };

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
  const [now, setNow] = useState(() => new Date(initialNow).getTime());
  const commandIds = useRef(new Map<string, string>());
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreQueueFocus = useRef<QueueFocusTarget | null>(null);
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
    const target = restoreQueueFocus.current;
    if (!target) return;
    const element =
      target.kind === "heading"
        ? queueHeadingRef.current
        : document.querySelector<HTMLElement>(
            `[data-help-request-${target.kind}="${target.requestId}"]`,
          );
    (element ?? queueHeadingRef.current)?.focus();
    restoreQueueFocus.current = null;
  }, [state.queue?.activityVersion, state.requests.length]);

  async function mutate(
    key: string,
    action: (requestId: string) => Promise<{
      success: boolean;
      error?: string;
      accessEnded?: true;
    }>,
    focusTarget: QueueFocusTarget,
  ) {
    if (loadingKey) return;
    setLoadingKey(key);
    setError(null);
    const requestId = commandIds.current.get(key) ?? createClientUuid();
    commandIds.current.set(key, requestId);
    // Realtime can refresh the server tree before the action response arrives.
    // Store the target first so that either that refresh or our explicit one
    // can restore keyboard focus after the mutation.
    restoreQueueFocus.current = focusTarget;
    try {
      const result = await action(requestId);
      if (!result.success) {
        restoreQueueFocus.current = null;
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error ?? "Kunne ikke oppdatere hjelpekøen.");
        return;
      }
      commandIds.current.delete(key);
      router.refresh();
    } catch {
      restoreQueueFocus.current = null;
      setError("Kunne ikke nå hjelpekøen akkurat nå. Prøv igjen.");
    } finally {
      setLoadingKey(null);
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

  return (
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
              {state.requests.map((request, index) => (
                <li
                  key={request.id}
                  data-help-request-row={request.id}
                  tabIndex={-1}
                  className="scroll-mt-24 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                >
                  <span
                    aria-label={`Køplass ${index + 1}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-black text-indigo-900"
                  >
                    {index + 1}
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
                  </div>
                  {request.status === "waiting" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void mutate(
                          `claim:${request.id}`,
                          (commandRequestId) =>
                            claimStudentHelpAction(
                              classId,
                              request.id,
                              commandRequestId,
                            ),
                          { kind: "action", requestId: request.id },
                        )
                      }
                      disabled={Boolean(loadingKey)}
                      data-help-request-action={request.id}
                      aria-label={`Jeg tar denne – ${request.studentName}`}
                      className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2.5 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
                    >
                      {loadingKey === `claim:${request.id}` ? "Tar …" : "Jeg tar denne"}
                    </button>
                  ) : request.claimedByCurrentTeacher ? (
                    <button
                      type="button"
                      onClick={() => {
                        const requestIndex = state.requests.findIndex(
                          (item) => item.id === request.id,
                        );
                        const nextRequest =
                          state.requests[requestIndex + 1] ??
                          state.requests[requestIndex - 1] ??
                          null;
                        void mutate(
                          `resolve:${request.id}`,
                          (commandRequestId) =>
                            resolveStudentHelpAction(
                              classId,
                              request.id,
                              commandRequestId,
                            ),
                          nextRequest
                            ? { kind: "row", requestId: nextRequest.id }
                            : { kind: "heading" },
                        );
                      }}
                      disabled={Boolean(loadingKey)}
                      data-help-request-action={request.id}
                      aria-label={`Ferdig hjulpet – ${request.studentName}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:bg-slate-500"
                    >
                      <Check aria-hidden="true" className="h-5 w-5" />
                      {loadingKey === `resolve:${request.id}` ? "Lagrer …" : "Ferdig hjulpet"}
                    </button>
                  ) : (
                    <span className="text-sm font-bold text-slate-600">Tatt</span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
