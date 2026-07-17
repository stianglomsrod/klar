"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, ShieldCheck, UserPlus, X } from "lucide-react";
import {
  createStaffAssignmentAction,
  revokeStaffAssignmentAction,
} from "@/app/actions/v3/access-actions";
import type {
  StaffAccessAssignment,
  StaffAccessManagement,
  StaffAssignmentStatus,
} from "@/server/staff/staff-service";
import type {
  AssignableStaffJobLabel,
  StaffCapability,
  StaffJobLabel,
} from "@/server/auth/policy";
import { createClientUuid } from "@/lib/client-uuid";
import {
  osloInstantToLocalDateTime,
  osloLocalDateTimeToIso,
} from "@/lib/oslo-date-time";
import { restoreDialogFocus, trapDialogFocus } from "./dialog-focus";

const JOB_LABELS: Record<StaffJobLabel, string> = {
  contact_teacher: "Kontaktlærer",
  subject_teacher: "Faglærer",
  special_educator: "ITO / spesialpedagog",
  substitute: "Vikar",
  legacy_teacher: "Overført lærertilgang",
  operational_owner: "Operativ eiertilgang",
};

const CAPABILITY_LABELS: Record<StaffCapability, string> = {
  "class.workspace.read": "Se klassens arbeidsflate",
  "task.publish": "Publisere oppgaver",
  "plan.preview": "Forhåndsvise ukeplan",
  "plan.publish": "Publisere kontrollert ukeplan",
  "help_queue.manage": "Følge opp hjelpekø",
  "student_support.update": "Endre elevens støttevisning",
  "student_progress.read": "Se elevens oppgavefremdrift",
  "task.return": "Åpne fullførte oppgaver igjen",
};

const STATUS_LABELS: Record<StaffAssignmentStatus, string> = {
  scheduled: "Planlagt",
  active: "Aktiv",
  expired: "Utløpt",
  revoked: "Tilbakekalt",
};

const SOURCE_LABELS = {
  manual: "Opprettet av eier",
  legacy_backfill: "Overført fra pilotkjernen",
  class_creation: "Opprettet med klassen",
} as const;

function initialTimes(now = new Date()) {
  const startsAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);
  return {
    startsAt: osloInstantToLocalDateTime(startsAt),
    endsAt: osloInstantToLocalDateTime(endsAt),
  };
}

function formatDate(value: string | null): string {
  if (!value) return "Ingen automatisk slutt";
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(new Date(value));
}

function localInputToIso(value: string): string {
  const parts = value.split("T");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Tidspunktet er ugyldig.");
  }
  return osloLocalDateTimeToIso(parts[0], parts[1]);
}

function formatLocalInput(value: string): string {
  try {
    return formatDate(localInputToIso(value));
  } catch {
    return "Velg tidspunkt";
  }
}

function Status({ status }: { status: StaffAssignmentStatus }) {
  return (
    <span className={`staff-assignment-status staff-assignment-status--${status}`}>
      <span aria-hidden="true">{status === "active" ? "●" : "○"}</span>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StaffAccessManager({
  management,
  initialNow,
}: {
  management: StaffAccessManagement;
  initialNow: string;
}) {
  const router = useRouter();
  const createDialog = useRef<HTMLDialogElement>(null);
  const revokeDialog = useRef<HTMLDialogElement>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const revokeTrigger = useRef<HTMLButtonElement>(null);
  const restoreCreateTrigger = useRef(true);
  const restoreRevokeTrigger = useRef(true);
  const messageSummary = useRef<HTMLParagraphElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const revokeErrorSummary = useRef<HTMLDivElement>(null);
  const [times, setTimes] = useState(() => initialTimes(new Date(initialNow)));
  const [targetUserId, setTargetUserId] = useState(management.people[0]?.id ?? "");
  const [classId, setClassId] = useState(management.classes[0]?.id ?? "");
  const [jobLabel, setJobLabel] =
    useState<AssignableStaffJobLabel>("contact_teacher");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [revoking, setRevoking] = useState<StaffAccessAssignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPerson = useMemo(
    () => management.people.find((person) => person.id === targetUserId),
    [management.people, targetUserId],
  );
  const selectedClass = useMemo(
    () => management.classes.find((classRow) => classRow.id === classId),
    [management.classes, classId],
  );

  useEffect(() => {
    if (message) messageSummary.current?.focus();
  }, [message]);

  function openCreate(event: React.MouseEvent<HTMLButtonElement>) {
    createTrigger.current = event.currentTarget;
    restoreCreateTrigger.current = true;
    setError(null);
    setMessage(null);
    setTimes(initialTimes());
    setIdempotencyKey(createClientUuid());
    createDialog.current?.showModal();
  }

  function closeCreate() {
    if (!loading) createDialog.current?.close();
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await createStaffAssignmentAction({
        organizationId: management.organizationId,
        targetUserId,
        classId,
        jobLabel,
        startsAt: localInputToIso(times.startsAt),
        endsAt: localInputToIso(times.endsAt),
        idempotencyKey,
      });
      if (!result.success) {
        setError(result.error);
        requestAnimationFrame(() => errorSummary.current?.focus());
        return;
      }
      restoreCreateTrigger.current = false;
      createDialog.current?.close();
      setMessage("Oppdraget er opprettet.");
      router.refresh();
    } catch {
      setError("Kontroller datoene og prøv igjen.");
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  function openRevoke(
    assignment: StaffAccessAssignment,
    trigger: HTMLButtonElement,
  ) {
    revokeTrigger.current = trigger;
    restoreRevokeTrigger.current = true;
    setError(null);
    setMessage(null);
    setRevoking(assignment);
    revokeDialog.current?.showModal();
  }

  function closeRevoke() {
    if (loading) return;
    revokeDialog.current?.close();
    setRevoking(null);
    setError(null);
  }

  async function revoke() {
    if (!revoking) return;
    setLoading(true);
    setError(null);
    try {
      const result = await revokeStaffAssignmentAction({
        organizationId: management.organizationId,
        assignmentId: revoking.id,
      });
      if (!result.success) {
        setError(result.error);
        requestAnimationFrame(() => revokeErrorSummary.current?.focus());
        return;
      }
      restoreRevokeTrigger.current = false;
      revokeDialog.current?.close();
      setRevoking(null);
      setMessage("Oppdraget er trukket tilbake.");
      router.refresh();
    } catch {
      setError("Oppdraget kunne ikke trekkes tilbake akkurat nå.");
      requestAnimationFrame(() => revokeErrorSummary.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  const canCreate = management.people.length > 0 && management.classes.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Kontrollplan
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Tilganger
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Gi en navngitt ansatt et personlig og tidsavgrenset oppdrag i én
            klasse.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!canCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
        >
          <UserPlus aria-hidden="true" size={20} />
          Gi tilgang
        </button>
      </div>

      {!canCreate && (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          Opprett først en klasse og kontroller at den ansatte finnes i
          organisasjonen.
        </p>
      )}
      {message && (
        <p
          ref={messageSummary}
          role="status"
          tabIndex={-1}
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
        >
          {message}
        </p>
      )}

      <section aria-labelledby="assignment-list-heading" className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="assignment-list-heading" className="text-xl font-bold">
              Oppdrag
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {management.assignments.length} registrert
            </p>
          </div>
        </div>
        {management.assignments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <ShieldCheck aria-hidden="true" className="text-indigo-700" />
            <p className="mt-3 font-semibold">Ingen oppdrag ennå</p>
            <p className="mt-1 text-sm text-slate-600">
              Bruk «Gi tilgang» for å opprette det første oppdraget.
            </p>
          </div>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {management.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="grid gap-4 border-b border-slate-200 p-5 last:border-b-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{assignment.personName}</p>
                    <Status status={assignment.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {JOB_LABELS[assignment.jobLabel]} · {assignment.className}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {SOURCE_LABELS[assignment.source]}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p className="inline-flex items-center gap-2">
                    <Clock3 aria-hidden="true" size={16} />
                    {formatDate(assignment.startsAt)}
                  </p>
                  <p className="mt-1 pl-6">til {formatDate(assignment.endsAt)}</p>
                </div>
                {(assignment.status === "active" || assignment.status === "scheduled") && (
                  <button
                    type="button"
                    onClick={(event) => openRevoke(assignment, event.currentTarget)}
                    aria-label={`Trekk tilbake oppdrag for ${assignment.personName} i ${assignment.className}`}
                    className="min-h-11 rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                  >
                    Trekk tilbake
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <dialog
        ref={createDialog}
        className="staff-dialog rounded-2xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        aria-labelledby="create-access-title"
        aria-describedby="create-access-description"
        onCancel={(event) => {
          if (loading) {
            event.preventDefault();
            return;
          }
          setError(null);
        }}
        onClose={() => {
          if (restoreCreateTrigger.current) {
            restoreDialogFocus(createTrigger.current);
          }
          restoreCreateTrigger.current = true;
        }}
        onKeyDown={trapDialogFocus}
      >
        <form onSubmit={create} className="staff-dialog__content">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 id="create-access-title" className="text-xl font-bold">
                Gi tilgang
              </h2>
              <p id="create-access-description" className="mt-1 text-sm leading-6 text-slate-600">
                Oppdraget gjelder én klasse og stopper automatisk ved slutt.
              </p>
            </div>
            <button
              type="button"
              onClick={closeCreate}
              aria-label="Lukk"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="staff-dialog__scroll space-y-5 px-5 py-5 sm:px-6">
            {error && (
              <div
                ref={errorSummary}
                role="alert"
                tabIndex={-1}
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <p className="font-bold">Oppdraget ble ikke opprettet</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            <fieldset className="space-y-4">
              <legend className="font-bold">Person og omfang</legend>
              <div>
                <label htmlFor="staff-person" className="text-sm font-semibold">
                  Ansatt
                </label>
                <select
                  id="staff-person"
                  value={targetUserId}
                  onChange={(event) => setTargetUserId(event.target.value)}
                  required
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {management.people.map((person) => (
                    <option key={person.id} value={person.id}>{person.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="staff-job-label" className="text-sm font-semibold">
                  Rolle i oppdraget
                </label>
                <select
                  id="staff-job-label"
                  value={jobLabel}
                  onChange={(event) =>
                    setJobLabel(event.target.value as AssignableStaffJobLabel)
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="contact_teacher">Kontaktlærer</option>
                  <option value="subject_teacher">Faglærer</option>
                  <option value="special_educator">ITO / spesialpedagog</option>
                  <option value="substitute">Vikar</option>
                </select>
              </div>
              <div>
                <label htmlFor="staff-class" className="text-sm font-semibold">
                  Klasse
                </label>
                <select
                  id="staff-class"
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  required
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {management.classes.map((classRow) => (
                    <option key={classRow.id} value={classRow.id}>{classRow.name}</option>
                  ))}
                </select>
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-bold">Gyldighet</legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-start" className="text-sm font-semibold">Start</label>
                  <input
                    id="staff-start"
                    type="datetime-local"
                    value={times.startsAt}
                    onChange={(event) => setTimes((current) => ({ ...current, startsAt: event.target.value }))}
                    required
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label htmlFor="staff-end" className="text-sm font-semibold">Slutt</label>
                  <input
                    id="staff-end"
                    type="datetime-local"
                    value={times.endsAt}
                    min={times.startsAt}
                    onChange={(event) => setTimes((current) => ({ ...current, endsAt: event.target.value }))}
                    required
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </fieldset>

            <section aria-labelledby="access-summary-title" className="rounded-2xl bg-indigo-50 p-4">
              <h3 id="access-summary-title" className="font-bold">Kontroller før du bekrefter</h3>
              <p className="mt-2 text-sm text-slate-800">
                {selectedPerson?.displayName ?? "Ansatt"} får rollen {JOB_LABELS[jobLabel].toLowerCase()} i {selectedClass?.name ?? "valgt klasse"}.
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                Fra {formatLocalInput(times.startsAt)} til {formatLocalInput(times.endsAt)}.
              </p>
              <ul className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                {management.profileCapabilities.map((capability) => (
                  <li key={capability} className="flex gap-2">
                    <span aria-hidden="true">✓</span>
                    {CAPABILITY_LABELS[capability]}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={closeCreate}
              disabled={loading}
              className="min-h-11 rounded-xl px-4 py-2 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={loading || !canCreate}
              className="min-h-11 rounded-xl bg-indigo-700 px-5 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-400"
            >
              {loading ? "Oppretter …" : "Bekreft oppdrag"}
            </button>
          </footer>
        </form>
      </dialog>

      <dialog
        ref={revokeDialog}
        className="staff-dialog staff-dialog--confirm rounded-2xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        aria-labelledby="revoke-access-title"
        aria-describedby="revoke-access-description"
        onCancel={(event) => {
          if (loading) {
            event.preventDefault();
            return;
          }
          setRevoking(null);
          setError(null);
        }}
        onClose={() => {
          if (restoreRevokeTrigger.current) {
            restoreDialogFocus(revokeTrigger.current);
          }
          restoreRevokeTrigger.current = true;
        }}
        onKeyDown={trapDialogFocus}
      >
        <div className="p-6">
          <h2 id="revoke-access-title" className="text-xl font-bold">Trekk tilbake oppdrag?</h2>
          <p id="revoke-access-description" className="mt-3 leading-6 text-slate-700">
            {revoking?.personName ?? "Den ansatte"} mister tilgang til {revoking?.className ?? "klassen"} ved neste lesing eller handling.
          </p>
          {error && (
            <div
              ref={revokeErrorSummary}
              role="alert"
              tabIndex={-1}
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              {error}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeRevoke}
              disabled={loading}
              autoFocus
              className="min-h-11 rounded-xl px-4 py-2 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              Behold tilgang
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={loading}
              className="min-h-11 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:bg-slate-400"
            >
              {loading ? "Trekker tilbake …" : "Trekk tilbake"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
