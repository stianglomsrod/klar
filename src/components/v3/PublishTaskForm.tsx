"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishClassTaskAction } from "@/app/actions/v3/task-actions";
import { redirectIfStaffAccessEnded } from "./staff-access-ended";

export function PublishTaskForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [supportLevel, setSupportLevel] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await publishClassTaskAction({
        classId,
        title,
        description,
        subject,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        supportLevel: Number(supportLevel),
      });
      if (!result.success) {
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setSubject("");
      setEstimatedMinutes("");
      setSuccess(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="publish-loose-task-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 id="publish-loose-task-heading" className="text-lg font-bold">
        Publiser løs oppgave
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Oppgaven legges utenfor klasseuken. Bruk øktene over når oppgaven skal
        inngå i elevens planlagte skoledag.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="task-title" className="text-sm font-semibold">
            Tittel
          </label>
          <input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label htmlFor="task-subject" className="text-sm font-semibold">
            Fag
          </label>
          <input
            id="task-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={80}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label htmlFor="task-minutes" className="text-sm font-semibold">
            Minutter
          </label>
          <input
            id="task-minutes"
            type="number"
            min={1}
            max={480}
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="task-description" className="text-sm font-semibold">
            Beskrivelse
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label htmlFor="support-level" className="text-sm font-semibold">
            Tilgjengelig støtte
          </label>
          <select
            id="support-level"
            value={supportLevel}
            onChange={(event) => setSupportLevel(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="1">Kort – bare det viktigste</option>
            <option value="2">Vanlig – med forklaring</option>
            <option value="3">Mer oversikt – også tidsestimat</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
          >
            {loading ? "Publiserer …" : "Publiser løs oppgave"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">
          Den løse oppgaven er publisert.
        </p>
      )}
    </section>
  );
}
