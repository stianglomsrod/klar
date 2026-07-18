"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useRouter } from "next/navigation";
import { Hand, Link2, X } from "lucide-react";
import {
  cancelOwnHelpAction,
  requestOwnHelpAction,
} from "@/app/actions/v3/help-actions";
import { createClientUuid } from "@/lib/client-uuid";
import {
  getHelpRequestStateKey,
  getHelpRequestTransition,
  isHelpCommandIntentSatisfied,
  type HelpCommandIntent,
} from "@/lib/help-request-transition";
import type { StudentHelpState } from "@/server/help/help-service";
import { trapDialogFocus } from "./dialog-focus";

type CommandIdentity = {
  target: string;
  id: string;
};

export function StudentHelpControl({
  state,
  taskAssignmentId,
  cancelPresentation = "dialog",
}: {
  state: StudentHelpState;
  taskAssignmentId?: string;
  cancelPresentation?: "dialog" | "inline";
}) {
  const router = useRouter();
  const [activeRequest, setActiveRequest] = useState(state.activeRequest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const loadingRef = useRef(false);
  const requestCommand = useRef<CommandIdentity | null>(null);
  const cancelCommand = useRef<CommandIdentity | null>(null);
  const previousPropRequestId = useRef(state.activeRequest?.id ?? null);
  const previousPropRequestStateKey = useRef(
    getHelpRequestStateKey(state.activeRequest),
  );
  const authoritativeRequest = useRef(state.activeRequest);
  const failedCommandIntent = useRef<HelpCommandIntent | null>(null);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterRequest = useRef(false);
  const cancelTitleId = useId();

  function restoreHelpFocus() {
    requestAnimationFrame(() => {
      const trigger = cancelTriggerRef.current;
      if (trigger?.isConnected && !trigger.disabled) {
        trigger.focus();
        return;
      }
      const taskTitle = document.querySelector<HTMLElement>(
        "dialog[open] #student-task-dialog-title",
      );
      (taskTitle ?? document.getElementById("main-content"))?.focus();
    });
  }

  useEffect(() => {
    const previousRequestId = previousPropRequestId.current;
    const nextRequestId = state.activeRequest?.id ?? null;
    const transition = getHelpRequestTransition(
      previousPropRequestStateKey.current,
      state.activeRequest,
    );
    authoritativeRequest.current = state.activeRequest;
    const failedIntent = failedCommandIntent.current;
    if (
      failedIntent &&
      isHelpCommandIntentSatisfied(failedIntent, state.activeRequest)
    ) {
      // Clear only an error whose requested outcome is now authoritative.
      // Unrelated cross-tab changes must not hide a genuine command failure.
      failedCommandIntent.current = null;
      setError(null);
    }
    if (transition.changed) {
      setFeedback(transition.feedback);
    }
    if (previousRequestId && !nextRequestId) {
      const cancellationWasOpen =
        cancelOpen || Boolean(cancelDialogRef.current?.open);
      setCancelOpen(false);
      if (cancelDialogRef.current?.open) {
        cancelDialogRef.current.close();
      } else if (cancellationWasOpen) {
        restoreHelpFocus();
      }
    }
    previousPropRequestId.current = nextRequestId;
    previousPropRequestStateKey.current = getHelpRequestStateKey(
      state.activeRequest,
    );
    setActiveRequest(state.activeRequest);
    if (state.activeRequest) requestCommand.current = null;
  }, [cancelOpen, state.activeRequest]);

  useEffect(() => {
    if (loading || !focusAfterRequest.current) return;
    focusAfterRequest.current = false;
    requestAnimationFrame(() => {
      const trigger = cancelTriggerRef.current;
      if (trigger?.isConnected && !trigger.disabled) {
        trigger.focus();
        return;
      }
      const taskTitle = document.querySelector<HTMLElement>(
        "dialog[open] #student-task-dialog-title",
      );
      (taskTitle ?? document.getElementById("main-content"))?.focus();
    });
  }, [loading]);

  if (!state.queue) return null;
  if (!activeRequest && state.queue.status !== "open") return null;

  const shouldContextualize = Boolean(
    activeRequest &&
      taskAssignmentId &&
      state.queue.status === "open" &&
      activeRequest.taskAssignmentId === null,
  );

  function commandFor(
    reference: MutableRefObject<CommandIdentity | null>,
    target: string,
  ): string {
    if (reference.current?.target !== target) {
      reference.current = { target, id: createClientUuid() };
    }
    return reference.current.id;
  }

  function clearCommandError() {
    failedCommandIntent.current = null;
    setError(null);
  }

  function reportCommandError(intent: HelpCommandIntent, message: string) {
    if (isHelpCommandIntentSatisfied(intent, authoritativeRequest.current)) {
      failedCommandIntent.current = null;
      setError(null);
      return;
    }
    failedCommandIntent.current = intent;
    setError(message);
  }

  async function requestHelp() {
    if (loadingRef.current || !state.queue) return;
    loadingRef.current = true;
    setLoading(true);
    clearCommandError();
    setFeedback(null);
    focusAfterRequest.current = false;
    const target = `${state.queue.id}:${taskAssignmentId ?? "general"}`;
    const requestId = commandFor(requestCommand, target);
    const contextualizing = Boolean(
      activeRequest &&
        taskAssignmentId &&
        activeRequest.taskAssignmentId === null,
    );
    const intent: HelpCommandIntent = {
      kind: "request",
      taskAssignmentId: taskAssignmentId ?? null,
    };
    try {
      const result = await requestOwnHelpAction(
        state.queue.id,
        requestId,
        taskAssignmentId,
      );
      if (!result.success) {
        reportCommandError(intent, result.error ?? "Kunne ikke be om hjelp.");
        return;
      }
      requestCommand.current = null;
      authoritativeRequest.current = result.activeRequest;
      setActiveRequest(result.activeRequest);
      setFeedback(
        taskAssignmentId
          ? "Hjelpen er knyttet til oppgaven."
          : "Du står i kø.",
      );
      focusAfterRequest.current = contextualizing;
      router.refresh();
    } catch {
      reportCommandError(
        intent,
        "Kunne ikke nå læreren akkurat nå. Prøv igjen.",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function openCancel(trigger: HTMLButtonElement) {
    cancelTriggerRef.current = trigger;
    clearCommandError();
    setCancelOpen(true);
    if (cancelPresentation === "dialog") {
      const dialog = cancelDialogRef.current;
      if (!dialog?.open) dialog?.showModal();
    }
    requestAnimationFrame(() => stayButtonRef.current?.focus());
  }

  function closeCancel() {
    if (loadingRef.current) return;
    if (cancelPresentation === "dialog") {
      cancelDialogRef.current?.close();
      return;
    }
    setCancelOpen(false);
    restoreHelpFocus();
  }

  async function cancelHelp() {
    if (!activeRequest || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    clearCommandError();
    const commandRequestId = commandFor(cancelCommand, activeRequest.id);
    const intent: HelpCommandIntent = { kind: "cancel" };
    try {
      const result = await cancelOwnHelpAction(
        activeRequest.id,
        commandRequestId,
      );
      if (!result.success) {
        reportCommandError(intent, result.error ?? "Kunne ikke gå ut av køen.");
        return;
      }
      authoritativeRequest.current = null;
      setActiveRequest(null);
      previousPropRequestId.current = null;
      requestCommand.current = null;
      cancelCommand.current = null;
      setFeedback(null);
      setCancelOpen(false);
      if (cancelDialogRef.current?.open) {
        cancelDialogRef.current.close();
      } else {
        restoreHelpFocus();
      }
      router.refresh();
    } catch {
      reportCommandError(
        intent,
        "Kunne ikke oppdatere køen akkurat nå. Prøv igjen.",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  const label = activeRequest
    ? "Står i kø. Åpne avmelding"
    : taskAssignmentId
      ? "Be om hjelp med denne oppgaven"
      : "Be om hjelp";

  const cancelActions = (
    <div
      role="group"
      aria-label="Gå ut av køen?"
      className={
        cancelPresentation === "inline"
          ? "flex max-w-full flex-wrap gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-2"
          : "mt-6 grid gap-3 sm:grid-cols-2"
      }
    >
      <button
        ref={stayButtonRef}
        type="button"
        onClick={closeCancel}
        disabled={loading}
        className="min-h-11 rounded-xl bg-white px-4 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
      >
        Bli i køen
      </button>
      <button
        type="button"
        onClick={() => void cancelHelp()}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
      >
        <X aria-hidden="true" className="h-5 w-5" />
        {loading ? "Oppdaterer …" : "Gå ut"}
      </button>
    </div>
  );

  return (
    <div className="relative flex max-w-full flex-col items-start gap-2">
      <button
        ref={cancelTriggerRef}
        type="button"
        aria-label={label}
        aria-pressed={Boolean(activeRequest)}
        aria-expanded={activeRequest ? cancelOpen : undefined}
        aria-busy={loading}
        disabled={
          loading || (!activeRequest && state.queue.status !== "open")
        }
        onClick={(event) => {
          if (!activeRequest) {
            void requestHelp();
          } else {
            openCancel(event.currentTarget);
          }
        }}
        className={`inline-flex min-h-12 min-w-12 max-w-full items-center justify-center gap-2 rounded-2xl px-3 font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-60 ${
          activeRequest
            ? "bg-indigo-700 text-white"
            : "border-2 border-indigo-200 bg-white text-indigo-800"
        }`}
      >
        <Hand aria-hidden="true" className="h-6 w-6 shrink-0" />
        {activeRequest && (
          <span className="whitespace-nowrap text-sm">Står i kø</span>
        )}
      </button>

      {shouldContextualize && (
        <button
          type="button"
          onClick={() => void requestHelp()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-60"
        >
          <Link2 aria-hidden="true" className="h-5 w-5" />
          Knytt til oppgaven
        </button>
      )}

      {cancelOpen && cancelPresentation === "inline" && (
        <div>
          {error && (
            <p role="alert" className="mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          {cancelActions}
        </div>
      )}

      {error && !cancelOpen && (
        <p
          role="alert"
          className="absolute bottom-full right-0 mb-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl bg-red-800 p-3 text-sm font-semibold text-white shadow-lg"
        >
          {error}
        </p>
      )}
      {feedback && (
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {feedback}
        </span>
      )}

      {cancelPresentation === "dialog" && (
        <dialog
          ref={cancelDialogRef}
          aria-labelledby={cancelTitleId}
          className="w-[min(24rem,calc(100%-2rem))] rounded-3xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50"
          onKeyDown={(event) => {
            if (event.key === "Escape" && loadingRef.current) {
              event.preventDefault();
              return;
            }
            trapDialogFocus(event);
          }}
          onCancel={(event) => {
            if (loadingRef.current) event.preventDefault();
          }}
          onClose={() => {
            setCancelOpen(false);
            restoreHelpFocus();
          }}
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={cancelTitleId} className="text-xl font-black">
                  Gå ut av køen?
                </h2>
                <p className="mt-2 text-slate-600">
                  Læreren ser ikke hånden din lenger.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancel}
                disabled={loading}
                aria-label="Lukk"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <X aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">
                {error}
              </p>
            )}
            {cancelActions}
          </div>
        </dialog>
      )}
    </div>
  );
}
