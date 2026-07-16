"use client";

import { useState } from "react";
import { updateOwnStudentExperienceAction } from "@/app/actions/v3/experience-actions";
import type {
  StudentExperience,
  SupportLevel,
} from "@/server/students/experience-service";

const SUPPORT_OPTIONS: Array<{
  level: SupportLevel;
  label: string;
  description: string;
}> = [
  { level: 1, label: "Kort", description: "Vis bare det viktigste." },
  { level: 2, label: "Vanlig", description: "Vis forklaringen når den finnes." },
  { level: 3, label: "Mer oversikt", description: "Vis også tidsestimat når det finnes." },
];

export function StudentExperienceControls({
  initialExperience,
  onSaved,
}: {
  initialExperience: StudentExperience;
  onSaved?: (experience: StudentExperience) => void;
}) {
  const [supportLevel, setSupportLevel] = useState(initialExperience.supportLevel);
  const [progressEnabled, setProgressEnabled] = useState(
    initialExperience.progressEnabled,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result = await updateOwnStudentExperienceAction({
        supportLevel,
        progressEnabled,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSupportLevel(result.experience.supportLevel);
      setProgressEnabled(result.experience.progressEnabled);
      onSaved?.(result.experience);
      setMessage("Visningen er lagret.");
    } catch {
      setError("Visningen kunne ikke lagres akkurat nå.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-2xl border border-sky-200 bg-white p-5">
      <summary className="cursor-pointer font-bold text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2">
        Tilpass visningen
      </summary>
      <form onSubmit={save} className="mt-5">
        <fieldset>
          <legend className="font-semibold">Hvor mye hjelp vil du se?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {SUPPORT_OPTIONS.map((option) => (
              <label
                key={option.level}
                className={`cursor-pointer rounded-xl border p-3 focus-within:ring-2 focus-within:ring-sky-600 ${
                  supportLevel === option.level
                    ? "border-sky-600 bg-sky-50"
                    : "border-slate-300"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="student-support-level"
                    value={option.level}
                    checked={supportLevel === option.level}
                    onChange={() => setSupportLevel(option.level)}
                    className="h-4 w-4 accent-sky-700"
                  />
                  {option.label}
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-600">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-3 focus-within:ring-2 focus-within:ring-sky-600">
          <input
            type="checkbox"
            checked={progressEnabled}
            onChange={(event) => setProgressEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 accent-sky-700"
          />
          <span>
            <span className="block font-semibold">Vis poeng og fremdrift</span>
            <span className="mt-1 block text-sm text-slate-600">
              Viser dine egne poeng, nivå og ferdige oppgaver. Det er ingen
              sammenligning med andre.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-xl bg-sky-700 px-4 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:bg-slate-500"
        >
          {saving ? "Lagrer …" : "Lagre visning"}
        </button>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
      </form>
    </details>
  );
}
