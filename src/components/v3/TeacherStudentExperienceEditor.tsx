"use client";

import { useState } from "react";
import { updateClassStudentExperienceAction } from "@/app/actions/v3/experience-actions";
import type { SupportLevel } from "@/server/students/experience-service";
import { redirectIfStaffAccessEnded } from "./staff-access-ended";

export function TeacherStudentExperienceEditor({
  classId,
  studentId,
  studentName,
  initialSupportLevel,
  initialFlowerRewardsAllowed,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  initialSupportLevel: SupportLevel;
  initialFlowerRewardsAllowed: boolean;
}) {
  const [supportLevel, setSupportLevel] = useState(initialSupportLevel);
  const [flowerRewardsAllowed, setFlowerRewardsAllowed] = useState(
    initialFlowerRewardsAllowed,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateClassStudentExperienceAction(classId, studentId, {
        supportLevel,
        flowerRewardsAllowed,
      });
      if (!result.success) {
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error);
        return;
      }
      setSupportLevel(result.experience.supportLevel);
      setFlowerRewardsAllowed(result.experience.flowerRewardsAllowed);
      setSaved(true);
    } catch {
      setError("Kunne ikke lagre visningen akkurat nå.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600">
        Tilpass visning
      </summary>
      <form
        onSubmit={save}
        className="mt-3 grid gap-3 sm:grid-cols-2 sm:items-end"
      >
        <div>
          <label htmlFor={`support-${studentId}`} className="font-semibold">
            Støtte for {studentName}
          </label>
          <select
            id={`support-${studentId}`}
            value={supportLevel}
            onChange={(event) => setSupportLevel(Number(event.target.value) as SupportLevel)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value={1}>Kort</option>
            <option value={2}>Vanlig</option>
            <option value={3}>Mer oversikt</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
          <input
            type="checkbox"
            checked={flowerRewardsAllowed}
            onChange={(event) => setFlowerRewardsAllowed(event.target.checked)}
            className="h-5 w-5 accent-indigo-700"
          />
          Blomsterhage tilgjengelig
        </label>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg bg-indigo-700 px-3 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
        >
          {saving ? "Lagrer …" : "Lagre"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      {saved && <p role="status" className="mt-2 font-semibold text-emerald-700">Lagret.</p>}
    </details>
  );
}
