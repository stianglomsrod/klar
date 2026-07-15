"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelOwnHelpAction,
  requestOwnHelpAction,
} from "@/app/actions/v3/help-actions";
import type { StudentHelpState } from "@/server/help/help-service";
import { useHelpQueueRealtime } from "./useHelpQueueRealtime";

export function StudentHelpControl({ state }: { state: StudentHelpState }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useHelpQueueRealtime(state.classId ?? "unassigned");

  if (!state.classId) return null;

  async function mutate(action: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Kunne ikke oppdatere hjelpekøen.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="help-heading" className="mt-8 rounded-3xl bg-slate-900 p-6 text-white">
      <h2 id="help-heading" className="text-2xl font-bold">
        Trenger du hjelp?
      </h2>
      {state.activeRequest ? (
        <>
          <p className="mt-2 text-slate-200" aria-live="polite">
            {state.activeRequest.status === "waiting"
              ? "Du står i kø. Læreren ser forespørselen din."
              : "En lærer har sett forespørselen og kommer til deg."}
          </p>
          <button
            type="button"
            onClick={() =>
              mutate(() => cancelOwnHelpAction(state.activeRequest?.id ?? ""))
            }
            disabled={loading}
            className="mt-4 rounded-xl border border-white/40 px-4 py-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60"
          >
            {loading ? "Oppdaterer …" : "Gå ut av køen"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-slate-200">
            Send en stille forespørsel til læreren.
          </p>
          <button
            type="button"
            onClick={() => mutate(() => requestOwnHelpAction(state.classId ?? ""))}
            disabled={loading}
            className="mt-4 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60"
          >
            {loading ? "Sender …" : "Be om hjelp"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
