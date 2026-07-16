"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  previewImportedPlanAction,
  publishImportedPlanAction,
} from "@/app/actions/v3/import-actions";
import { createClientUuid } from "@/lib/client-uuid";
import { redirectIfStaffAccessEnded } from "./staff-access-ended";
import type { ImportedTask } from "@/server/import/types";

type EditableTask = ImportedTask & { clientId: string };

function withClientIds(tasks: ImportedTask[]): EditableTask[] {
  return tasks.map((task, index) => ({
    ...task,
    clientId: `${index}-${createClientUuid()}`,
  }));
}

export function SmartImportPanel({
  classId,
  canPreview,
  canPublish,
}: {
  classId: string;
  canPreview: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (!canPreview) return null;

  async function preview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    setTasks([]);
    setWarnings([]);
    try {
      const result = await previewImportedPlanAction(classId, formData);
      if (!result.success) {
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error);
        return;
      }
      setTasks(withClientIds(result.preview.tasks));
      setWarnings(result.preview.warnings);
    } catch {
      setError("Dokumentet kunne ikke forhåndsvises akkurat nå.");
    } finally {
      setPreviewing(false);
    }
  }

  function updateTask(
    clientId: string,
    field: "title" | "subject",
    value: string,
  ) {
    setTasks((current) =>
      current.map((task) =>
        task.clientId === clientId
          ? { ...task, [field]: field === "subject" ? value || null : value }
          : task,
      ),
    );
  }

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = tasks.map((task) => ({
        title: task.title,
        description: task.description,
        subject: task.subject,
        estimatedMinutes: task.estimatedMinutes,
        supportLevel: task.supportLevel,
      }));
      const result = await publishImportedPlanAction(classId, payload);
      if (!result.success) {
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error);
        return;
      }
      setTasks([]);
      setWarnings([]);
      if (fileInput.current) fileInput.current.value = "";
      setSuccess(
        `${result.publishedCount} ${result.publishedCount === 1 ? "oppgave er" : "oppgaver er"} publisert.`,
      );
      router.refresh();
    } catch {
      setError("Planen kunne ikke publiseres akkurat nå.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section
      aria-labelledby="smart-import-heading"
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 id="smart-import-heading" className="text-lg font-bold">
        Smart Import
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
        Last opp en ukeplan som DOCX. Klar foreslår oppgaver, men ingenting blir
        publisert før du har kontrollert og bekreftet listen.
      </p>

      <form onSubmit={preview} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="weekly-plan" className="text-sm font-semibold">
            Ukeplan, maks 2 MB
          </label>
          <input
            ref={fileInput}
            id="weekly-plan"
            name="plan"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
        <button
          type="submit"
          disabled={previewing || publishing}
          className="min-h-11 rounded-xl border border-indigo-700 px-4 py-2.5 font-semibold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:border-slate-400 disabled:text-slate-500"
        >
          {previewing ? "Leser dokumentet …" : "Lag forhåndsvisning"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {success}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Kontroller dette</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">Forslag til oppgaver</h3>
              <p className="mt-1 text-sm text-slate-600">
                Rediger titler og fag, eller fjern forslag som ikke skal med.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {tasks.length} {tasks.length === 1 ? "oppgave" : "oppgaver"}
            </p>
          </div>

          <ol className="mt-4 space-y-3">
            {tasks.map((task, index) => (
              <li
                key={task.clientId}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[2fr_1fr_auto] md:items-end"
              >
                <div>
                  <label htmlFor={`import-title-${task.clientId}`} className="text-sm font-semibold">
                    Oppgave {index + 1}
                  </label>
                  <input
                    id={`import-title-${task.clientId}`}
                    value={task.title}
                    onChange={(event) => updateTask(task.clientId, "title", event.target.value)}
                    maxLength={160}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label htmlFor={`import-subject-${task.clientId}`} className="text-sm font-semibold">
                    Fag
                  </label>
                  <input
                    id={`import-subject-${task.clientId}`}
                    value={task.subject ?? ""}
                    onChange={(event) => updateTask(task.clientId, "subject", event.target.value)}
                    maxLength={80}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTasks((current) => current.filter((item) => item.clientId !== task.clientId))}
                  className="min-h-11 rounded-xl px-3 py-2.5 font-semibold text-red-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-red-600"
                  aria-label={`Fjern oppgave ${index + 1}: ${task.title}`}
                >
                  Fjern
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p className="max-w-2xl text-sm text-slate-600">
              {canPublish
                ? "Ved publisering opprettes oppgavene og tildeles elevene i klassen i én samlet operasjon."
                : "Du kan kontrollere forslagene, men dette oppdraget gir ikke tilgang til å publisere dem."}
            </p>
            {canPublish && (
              <button
                type="button"
                onClick={publish}
                disabled={publishing || tasks.some((task) => !task.title.trim())}
                className="min-h-11 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
              >
                {publishing ? "Publiserer …" : `Bekreft og publiser ${tasks.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
