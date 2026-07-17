"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeacherClassAction } from "@/app/actions/v3/class-actions";

export function CreateClassForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await createTeacherClassAction({
        organizationId,
        name,
        academicYear,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/v3/teacher/classes/${result.classId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Ny klasse</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <div>
          <label htmlFor="class-name" className="text-sm font-semibold">
            Klassenavn
          </label>
          <input
            id="class-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="5A"
          />
        </div>
        <div>
          <label htmlFor="academic-year" className="text-sm font-semibold">
            Skoleår
          </label>
          <input
            id="academic-year"
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            maxLength={20}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="2026/2027"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
        >
          {loading ? "Oppretter …" : "Opprett"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
