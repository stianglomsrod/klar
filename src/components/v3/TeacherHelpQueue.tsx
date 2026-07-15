"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  claimStudentHelpAction,
  resolveStudentHelpAction,
} from "@/app/actions/v3/help-actions";
import type { TeacherHelpQueueItem } from "@/server/help/help-service";
import { useHelpQueueRealtime } from "./useHelpQueueRealtime";

export function TeacherHelpQueue({
  classId,
  requests,
}: {
  classId: string;
  requests: TeacherHelpQueueItem[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useHelpQueueRealtime(classId);

  async function mutate(
    requestId: string,
    action: () => Promise<{ success: boolean; error?: string }>,
  ) {
    setLoadingId(requestId);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Kunne ikke oppdatere hjelpekøen.");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section aria-labelledby="queue-heading" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="queue-heading" className="text-xl font-bold">
          Hjelpekø
        </h2>
        <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold">
          {requests.length}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">Ingen venter på hjelp.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {requests.map((request, index) => (
            <li key={request.id} className="flex flex-col gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">
                  {index + 1}. {request.studentName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {request.status === "waiting" ? "Venter" : "Sett av lærer"}
                </p>
              </div>
              {request.status === "waiting" ? (
                <button
                  type="button"
                  onClick={() =>
                    mutate(request.id, () => claimStudentHelpAction(classId, request.id))
                  }
                  disabled={loadingId === request.id}
                  className="rounded-xl bg-amber-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2 disabled:bg-slate-500"
                >
                  {loadingId === request.id ? "Oppdaterer …" : "Jeg tar denne"}
                </button>
              ) : request.claimedByCurrentTeacher ? (
                <button
                  type="button"
                  onClick={() =>
                    mutate(request.id, () => resolveStudentHelpAction(classId, request.id))
                  }
                  disabled={loadingId === request.id}
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:bg-slate-500"
                >
                  {loadingId === request.id ? "Oppdaterer …" : "Ferdig hjulpet"}
                </button>
              ) : (
                <span className="text-sm font-semibold text-slate-600">Tatt av en annen lærer</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
