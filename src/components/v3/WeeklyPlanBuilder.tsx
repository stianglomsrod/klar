"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, Clock3, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { publishInitialWeeklyPlanAction } from "@/app/actions/v3/weekly-plan-actions";
import { createClientUuid } from "@/lib/client-uuid";
import { osloMondayForInstant } from "@/lib/oslo-date-time";
import type {
  InitialWeeklyPlanInput,
  WeeklyPlanSessionInput,
  WeeklyPlanTaskInput,
  PublishedWeeklyPlanSummary,
} from "@/server/plans/weekly-plan-service";
import { redirectIfStaffAccessEnded } from "./staff-access-ended";

function currentMonday(): string {
  return osloMondayForInstant(new Date());
}

function addWeeks(dateInput: string, weeks: number): string {
  const date = new Date(`${dateInput}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function firstUnpublishedMonday(publishedWeeks: Set<string>): string {
  const start = currentMonday();
  for (let offset = 0; offset < 104; offset += 1) {
    const candidate = addWeeks(start, offset);
    if (!publishedWeeks.has(candidate)) return candidate;
  }
  return start;
}

function emptyTask(): WeeklyPlanTaskInput {
  return {
    logicalKey: createClientUuid(),
    title: "",
    description: "",
    subject: null,
    estimatedMinutes: null,
    supportLevel: 2,
  };
}

function emptySession(date: string): WeeklyPlanSessionInput {
  return {
    logicalKey: createClientUuid(),
    title: "",
    subject: "",
    date,
    startTime: "09:00",
    endTime: "09:45",
    tasks: [emptyTask()],
  };
}

function formatWeekRange(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "valgt uke";
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

function formatSessionDate(dateInput: string): string {
  const date = new Date(`${dateInput}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateInput;
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function shiftDateWithWeek(
  sessionDate: string,
  previousWeekStart: string,
  nextWeekStart: string,
): string {
  const session = new Date(`${sessionDate}T12:00:00Z`);
  const previous = new Date(`${previousWeekStart}T12:00:00Z`);
  const next = new Date(`${nextWeekStart}T12:00:00Z`);
  if ([session, previous, next].some((date) => Number.isNaN(date.getTime()))) {
    return sessionDate;
  }
  session.setUTCDate(
    session.getUTCDate() + Math.round((next.getTime() - previous.getTime()) / 86_400_000),
  );
  return session.toISOString().slice(0, 10);
}

function validateForReview(
  weekStartDate: string,
  sessions: WeeklyPlanSessionInput[],
): string | null {
  const weekStart = new Date(`${weekStartDate}T12:00:00Z`);
  if (Number.isNaN(weekStart.getTime()) || weekStart.getUTCDay() !== 1) {
    return "Uken må starte på en mandag.";
  }
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const intervals: { start: string; end: string }[] = [];
  for (const [index, session] of sessions.entries()) {
    const sessionDate = new Date(`${session.date}T12:00:00Z`);
    if (
      Number.isNaN(sessionDate.getTime()) ||
      sessionDate < weekStart ||
      sessionDate > weekEnd
    ) {
      return `Datoen for økt ${index + 1} må ligge i den valgte uken.`;
    }
    if (session.endTime <= session.startTime) {
      return `Sluttidspunktet for økt ${index + 1} må være etter starttidspunktet.`;
    }
    intervals.push({
      start: `${session.date}T${session.startTime}`,
      end: `${session.date}T${session.endTime}`,
    });
  }
  intervals.sort((first, second) => first.start.localeCompare(second.start));
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) {
      return "Undervisningsøktene kan ikke overlappe.";
    }
  }
  return null;
}

export function WeeklyPlanBuilder({
  classId,
  publishedPlans,
}: {
  classId: string;
  publishedPlans: PublishedWeeklyPlanSummary[];
}) {
  const router = useRouter();
  const publishedWeeks = useMemo(
    () => new Set(publishedPlans.map((plan) => plan.weekStartDate)),
    [publishedPlans],
  );
  const initialMonday = useMemo(
    () => firstUnpublishedMonday(publishedWeeks),
    [publishedWeeks],
  );
  const [weekStartDate, setWeekStartDate] = useState(initialMonday);
  const [sessions, setSessions] = useState<WeeklyPlanSessionInput[]>(() => [
    emptySession(initialMonday),
  ]);
  const [reviewing, setReviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const successMessage = useRef<HTMLParagraphElement>(null);
  const weekStartInput = useRef<HTMLInputElement>(null);
  const taskCount = sessions.reduce((count, session) => count + session.tasks.length, 0);
  const publishedWeekSelected = publishedWeeks.has(weekStartDate);

  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
  }, [reviewing]);

  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  useEffect(() => {
    if (success) successMessage.current?.focus();
  }, [success]);

  function changed() {
    setReviewing(false);
    setError(null);
    setSuccess(null);
    requestId.current = null;
  }

  function updateSession(
    logicalKey: string,
    field: Exclude<keyof WeeklyPlanSessionInput, "logicalKey" | "tasks">,
    value: string,
  ) {
    changed();
    setSessions((current) =>
      current.map((session) =>
        session.logicalKey === logicalKey ? { ...session, [field]: value } : session,
      ),
    );
  }

  function updateWeekStart(nextWeekStart: string) {
    changed();
    setSessions((current) =>
      current.map((session) => ({
        ...session,
        date: shiftDateWithWeek(session.date, weekStartDate, nextWeekStart),
      })),
    );
    setWeekStartDate(nextWeekStart);
  }

  function updateTask(
    sessionKey: string,
    taskKey: string,
    field: "title" | "description",
    value: string,
  ) {
    changed();
    setSessions((current) =>
      current.map((session) =>
        session.logicalKey !== sessionKey
          ? session
          : {
              ...session,
              tasks: session.tasks.map((task) =>
                task.logicalKey === taskKey ? { ...task, [field]: value } : task,
              ),
            },
      ),
    );
  }

  function addSession() {
    changed();
    setSessions((current) => [...current, emptySession(weekStartDate)]);
  }

  function removeSession(logicalKey: string) {
    if (sessions.length === 1) return;
    changed();
    setSessions((current) => current.filter((session) => session.logicalKey !== logicalKey));
  }

  function addTask(sessionKey: string) {
    changed();
    setSessions((current) =>
      current.map((session) =>
        session.logicalKey === sessionKey
          ? { ...session, tasks: [...session.tasks, emptyTask()] }
          : session,
      ),
    );
  }

  function removeTask(sessionKey: string, taskKey: string) {
    changed();
    setSessions((current) =>
      current.map((session) =>
        session.logicalKey !== sessionKey
          ? session
          : {
              ...session,
              tasks: session.tasks.filter((task) => task.logicalKey !== taskKey),
            },
      ),
    );
  }

  function startReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (publishedWeekSelected) {
      setError("Denne uken har allerede en publisert plan. Velg en annen uke.");
      return;
    }
    const validationError = validateForReview(weekStartDate, sessions);
    if (validationError) {
      setError(validationError);
      return;
    }
    setReviewing(true);
    requestId.current = createClientUuid();
  }

  async function publish() {
    if (publishing) return;
    const activeRequestId = requestId.current ?? createClientUuid();
    requestId.current = activeRequestId;
    setPublishing(true);
    setError(null);
    setSuccess(null);

    const plan: InitialWeeklyPlanInput = {
      weekStartDate,
      timezone: "Europe/Oslo",
      sessions,
    };

    try {
      const result = await publishInitialWeeklyPlanAction(
        classId,
        activeRequestId,
        plan,
      );
      if (!result.success) {
        if (redirectIfStaffAccessEnded(result, classId)) return;
        setError(result.error);
        return;
      }
      const { publication } = result;
      setSuccess(
        publication.alreadyPublished
          ? "Denne planen var allerede publisert. Ingen oppgaver ble duplisert."
          : `${publication.sessionCount} ${publication.sessionCount === 1 ? "økt" : "økter"} og ${publication.taskCount} ${publication.taskCount === 1 ? "oppgave" : "oppgaver"} er publisert.`,
      );
      setReviewing(false);
      router.refresh();
    } catch {
      setError("Ukeplanen kunne ikke publiseres akkurat nå. Prøv igjen.");
    } finally {
      setPublishing(false);
    }
  }

  function returnToEditing() {
    setReviewing(false);
    requestAnimationFrame(() => weekStartInput.current?.focus());
  }

  return (
    <section
      aria-labelledby="weekly-plan-builder-heading"
      className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/60 p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
            Klasseuke
          </p>
          <h2 id="weekly-plan-builder-heading" className="mt-2 text-2xl font-black tracking-tight">
            Planlegg undervisningsøktene
          </h2>
          <p className="mt-2 max-w-3xl leading-6 text-slate-600">
            Legg oppgavene i økten de hører til. Første publisering låses, og
            eleven ser forrige, aktuell og neste økt.
          </p>
        </div>
        <div className="rounded-2xl bg-indigo-950 px-4 py-3 text-sm text-white">
          <p className="font-bold">Publiser første klasseuke</p>
          <p className="mt-1 text-indigo-100">Økter og oppgaver publiseres samlet.</p>
        </div>
      </div>

      {publishedPlans.length > 0 && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-black text-emerald-950">Publiserte klasseuker</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {publishedPlans.map((plan) => (
              <li
                key={plan.id}
                className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-sm font-bold text-emerald-900"
              >
                Uken {formatWeekRange(plan.weekStartDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={startReview} className="mt-7">
        <div className="max-w-sm">
          <label htmlFor="weekly-plan-start" className="flex items-center gap-2 font-bold">
            <CalendarDays aria-hidden="true" className="h-5 w-5 text-indigo-700" />
            Uken starter
          </label>
          <input
            ref={weekStartInput}
            id="weekly-plan-start"
            type="date"
            required
            value={weekStartDate}
            onChange={(event) => {
              updateWeekStart(event.target.value);
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mt-2 text-sm text-slate-600">Velg mandagen i skoleuken.</p>
          {publishedWeekSelected && (
            <p className="mt-2 text-sm font-bold text-amber-900">
              Denne uken er allerede publisert. Velg en annen uke.
            </p>
          )}
        </div>

        <ol className="mt-7 space-y-5">
          {sessions.map((session, sessionIndex) => (
            <li key={session.logicalKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black">Økt {sessionIndex + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeSession(session.logicalKey)}
                  disabled={sessions.length === 1}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:text-slate-400"
                >
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                  Fjern økt
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr]">
                <label className="font-semibold">
                  Tittel
                  <input
                    required
                    maxLength={120}
                    value={session.title}
                    onChange={(event) => updateSession(session.logicalKey, "title", event.target.value)}
                    placeholder="For eksempel Lesestund"
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="font-semibold">
                  Fag
                  <input
                    maxLength={80}
                    value={session.subject ?? ""}
                    onChange={(event) => updateSession(session.logicalKey, "subject", event.target.value)}
                    placeholder="Norsk"
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="font-semibold">
                  Dato
                  <input
                    required
                    type="date"
                    value={session.date}
                    onChange={(event) => updateSession(session.logicalKey, "date", event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="font-semibold">
                  Start
                  <input
                    required
                    type="time"
                    value={session.startTime}
                    onChange={(event) => updateSession(session.logicalKey, "startTime", event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="font-semibold">
                  Slutt
                  <input
                    required
                    type="time"
                    value={session.endTime}
                    onChange={(event) => updateSession(session.logicalKey, "endTime", event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
              </div>

              <fieldset className="mt-5 border-t border-slate-200 pt-5">
                <legend className="px-1 font-black">Oppgaver i økten</legend>
                {session.tasks.length === 0 && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Økten har ingen oppgaver ennå. Det er helt greit å publisere en
                    undervisningsøkt uten oppgaver.
                  </p>
                )}
                <ol className="mt-3 space-y-3">
                  {session.tasks.map((task, taskIndex) => (
                    <li key={task.logicalKey} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
                      <label className="font-semibold">
                        Oppgave {taskIndex + 1}
                        <input
                          required
                          maxLength={160}
                          value={task.title}
                          onChange={(event) => updateTask(session.logicalKey, task.logicalKey, "title", event.target.value)}
                          placeholder="Hva skal eleven gjøre?"
                          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </label>
                      <label className="font-semibold">
                        Kort instruksjon <span className="font-normal text-slate-500">(valgfritt)</span>
                        <input
                          maxLength={4000}
                          value={task.description ?? ""}
                          onChange={(event) => updateTask(session.logicalKey, task.logicalKey, "description", event.target.value)}
                          placeholder="For eksempel side 12 i arbeidsboka"
                          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeTask(session.logicalKey, task.logicalKey)}
                        aria-label={`Fjern oppgave ${taskIndex + 1} fra økt ${sessionIndex + 1}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                      >
                        <Trash2 aria-hidden="true" className="h-5 w-5" />
                        <span className="ml-2 md:sr-only">Fjern oppgave</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => addTask(session.logicalKey)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <Plus aria-hidden="true" className="h-5 w-5" />
                  Legg til oppgave
                </button>
              </fieldset>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={addSession}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-700 bg-white px-4 font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          Legg til økt
        </button>

        {error && (
          <p
            ref={errorMessage}
            role="alert"
            tabIndex={-1}
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800 focus:outline-none"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            ref={successMessage}
            role="status"
            tabIndex={-1}
            className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-semibold text-emerald-900 focus:outline-none"
          >
            {success}
          </p>
        )}

        {reviewing ? (
          <div className="mt-6 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-5" role="region" aria-labelledby="weekly-plan-review-heading">
            <div className="flex items-start gap-3">
              <Check aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-indigo-800" />
              <div>
                <h3
                  ref={reviewHeading}
                  id="weekly-plan-review-heading"
                  tabIndex={-1}
                  className="text-lg font-black focus:outline-none"
                >
                  Kontroller før publisering
                </h3>
                <p className="mt-2 leading-6 text-slate-700">
                  Du publiserer {sessions.length} {sessions.length === 1 ? "økt" : "økter"} med {taskCount} {taskCount === 1 ? "oppgave" : "oppgaver"} for {formatWeekRange(weekStartDate)}.
                  {taskCount > 0
                    ? " Alle nåværende elever i klassen får oppgavene i én samlet operasjon."
                    : " Øktene blir synlige uten at det opprettes oppgavetildelinger."}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Den publiserte planen kan ikke redigeres direkte etterpå.
                </p>
                <ol className="mt-4 space-y-3">
                  {sessions.map((session, index) => (
                    <li key={session.logicalKey} className="rounded-xl bg-white p-3">
                      <p className="font-black">
                        {index + 1}. {session.title} · {formatSessionDate(session.date)} · {session.startTime}–{session.endTime}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {session.tasks.length > 0
                          ? session.tasks.map((task) => task.title).join(" · ")
                          : "Ingen oppgaver i økten"}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void publish()}
                aria-disabled={publishing}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 aria-disabled:cursor-wait aria-disabled:bg-slate-500"
              >
                <Check aria-hidden="true" className="h-5 w-5" />
                {publishing ? "Publiserer …" : "Publiser klasseuken"}
              </button>
              <button
                type="button"
                onClick={returnToEditing}
                disabled={publishing}
                className="min-h-11 rounded-xl px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                Gå tilbake og endre
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            <Clock3 aria-hidden="true" className="h-5 w-5" />
            Kontroller klasseuken
          </button>
        )}
      </form>
    </section>
  );
}
