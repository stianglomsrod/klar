"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { reopenStudentTaskAction } from "@/app/actions/v3/task-actions";
import { createClientUuid } from "@/lib/client-uuid";
import type { TaskReopenReason } from "@/server/supabase/database.types";
import { redirectIfStaffAccessEnded } from "./staff-access-ended";

const REASON_LABELS: Record<TaskReopenReason, string> = {
  continue_working: "Jobbe videre",
  completed_by_mistake: "Trykket ferdig ved en feil",
  needs_review: "Se på oppgaven en gang til",
  other: "Annet",
};

export function TeacherTaskReopenControl({
  classId,
  assignmentId,
  taskTitle,
  studentName,
}: {
  classId: string;
  assignmentId: string;
  taskTitle: string;
  studentName: string;
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [reasonCode, setReasonCode] =
    useState<TaskReopenReason>("continue_working");
  const [studentMessage, setStudentMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function invalidateRequest(): void {
    requestRef.current = null;
    setError(null);
  }

  function closeForm(): void {
    detailsRef.current?.removeAttribute("open");
    detailsRef.current?.querySelector("summary")?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const normalizedMessage = studentMessage.trim();
    const fingerprint = JSON.stringify({ reasonCode, normalizedMessage });
    const request =
      requestRef.current?.fingerprint === fingerprint
        ? requestRef.current
        : { fingerprint, id: createClientUuid() };
    requestRef.current = request;

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await reopenStudentTaskAction({
        classId,
        assignmentId,
        requestId: request.id,
        reasonCode,
        studentMessage: normalizedMessage || undefined,
      });
      if (!result.success) {
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error);
        return;
      }

      requestRef.current = null;
      setSuccess(
        result.progress.changed && result.progress.status === "reopened"
          ? `Oppgaven er åpnet igjen for ${studentName}.`
          : `Oppgaven var allerede tilgjengelig for ${studentName}.`,
      );
      closeForm();
      router.refresh();
    } catch {
      setError("Kunne ikke åpne oppgaven igjen akkurat nå. Prøv igjen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <details ref={detailsRef}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Åpne igjen for {studentName}
        </summary>
        <form
          onSubmit={submit}
          className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4"
        >
          <p className="font-bold">{taskTitle}</p>
          <p className="mt-1 text-sm text-slate-700">
            Eleven kan fullføre oppgaven på nytt. Historikken beholdes.
          </p>

          <label
            htmlFor={`reopen-reason-${assignmentId}`}
            className="mt-4 block font-semibold"
          >
            Hva skal eleven gjøre?
          </label>
          <select
            id={`reopen-reason-${assignmentId}`}
            value={reasonCode}
            onChange={(event) => {
              setReasonCode(event.target.value as TaskReopenReason);
              invalidateRequest();
            }}
            disabled={pending}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:bg-slate-100"
          >
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label
            htmlFor={`reopen-message-${assignmentId}`}
            className="mt-4 block font-semibold"
          >
            Kort beskjed til eleven {reasonCode === "other" ? "(må fylles ut)" : "(valgfritt)"}
          </label>
          <textarea
            id={`reopen-message-${assignmentId}`}
            value={studentMessage}
            onChange={(event) => {
              setStudentMessage(event.target.value);
              invalidateRequest();
            }}
            required={reasonCode === "other"}
            maxLength={240}
            rows={3}
            disabled={pending}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:bg-slate-100"
          />

          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={closeForm}
              disabled={pending}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:text-slate-500"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
            >
              {pending ? "Lagrer …" : "Åpne igjen"}
            </button>
          </div>
        </form>
      </details>
      {success && (
        <p role="status" className="mt-2 text-sm font-semibold text-emerald-800">
          {success}
        </p>
      )}
    </div>
  );
}
