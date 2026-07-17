"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPrototypeStudentAction } from "@/app/actions/v3/student-actions";
import type { CreatedPrototypeStudent } from "@/server/students/create-student";

export function CreateStudentForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [createdStudent, setCreatedStudent] =
    useState<CreatedPrototypeStudent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedStudent(null);
    try {
      const result = await createPrototypeStudentAction(classId, displayName);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCreatedStudent(result.student);
      setDisplayName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Legg til prototypeelev</h2>
      <p className="mt-1 text-sm text-slate-600">
        Bruk et kort visningsnavn. Innloggingsopplysningene vises bare én gang.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="student-display-name" className="text-sm font-semibold">
            Visningsnavn
          </label>
          <input
            id="student-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            required
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Elev Furu"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
        >
          {loading ? "Oppretter …" : "Opprett elev"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {createdStudent && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <p className="font-semibold text-emerald-950">
            {createdStudent.displayName} er opprettet
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800">
                Elevkode
              </dt>
              <dd className="mt-1 font-mono text-lg">{createdStudent.studentCode}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800">
                Midlertidig passord
              </dt>
              <dd className="mt-1 font-mono text-lg">{createdStudent.password}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
