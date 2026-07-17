import "server-only";

import { createHash } from "node:crypto";
import {
  OSLO_TIMEZONE,
  OsloDateTimeError,
  osloLocalDateTimeToIso as convertOsloLocalDateTimeToIso,
} from "@/lib/oslo-date-time";
import { requireStaffCapability } from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";

export const WEEKLY_PLAN_TIMEZONE = OSLO_TIMEZONE;

export type WeeklyPlanTaskInput = {
  logicalKey: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  estimatedMinutes?: number | null;
  supportLevel?: 1 | 2 | 3;
};

export type WeeklyPlanSessionInput = {
  logicalKey: string;
  title: string;
  subject?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  tasks: WeeklyPlanTaskInput[];
};

export type InitialWeeklyPlanInput = {
  weekStartDate: string;
  timezone?: typeof WEEKLY_PLAN_TIMEZONE;
  sessions: WeeklyPlanSessionInput[];
};

export type WeeklyPlanPublishResult = {
  requestId: string;
  weeklyPlanId: string;
  revisionId: string;
  lockVersion: number;
  alreadyPublished: boolean;
  sessionCount: number;
  taskCount: number;
};

export type PublishedWeeklyPlanSummary = {
  id: string;
  weekStartDate: string;
  lockVersion: number;
};

type NormalizedTask = {
  logical_key: string;
  title: string;
  description: string | null;
  subject: string | null;
  estimated_minutes: number | null;
  support_level: 1 | 2 | 3;
};

type NormalizedSession = {
  logical_key: string;
  title: string;
  subject: string | null;
  starts_at: string;
  ends_at: string;
  tasks: NormalizedTask[];
};

type NormalizedCandidate = {
  schema_version: "weekly_plan_v1";
  sessions: NormalizedSession[];
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function isUuidV4(value: unknown): value is string {
  return isUuid(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-4/i.test(value);
}

function parseDate(value: string, label: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new PrototypeDataError(`${label} har ugyldig dato.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new PrototypeDataError(`${label} har ugyldig dato.`);
  }
  return { year, month, day, hour: 0, minute: 0 };
}

export function osloLocalDateTimeToIso(date: string, time: string): string {
  try {
    return convertOsloLocalDateTimeToIso(date, time);
  } catch (error) {
    if (error instanceof OsloDateTimeError) {
      throw new PrototypeDataError(error.message);
    }
    throw error;
  }
}

function isMonday(parts: DateParts): boolean {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() === 1;
}

function normalizeText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const normalized = value?.normalize("NFC").trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new PrototypeDataError(`Teksten kan ikke være lengre enn ${maxLength} tegn.`);
  }
  return normalized;
}

function normalizeCandidate(input: InitialWeeklyPlanInput): NormalizedCandidate {
  const weekStart = parseDate(input.weekStartDate, "Uken");
  if (!isMonday(weekStart)) {
    throw new PrototypeDataError("Ukeplanen må starte på en mandag.");
  }
  if ((input.timezone ?? WEEKLY_PLAN_TIMEZONE) !== WEEKLY_PLAN_TIMEZONE) {
    throw new PrototypeDataError("Ukeplanen må bruke norsk tid.");
  }
  if (!Array.isArray(input.sessions) || input.sessions.length < 1 || input.sessions.length > 30) {
    throw new PrototypeDataError("Ukeplanen må ha mellom 1 og 30 økter.");
  }

  const weekStartMs = Date.UTC(weekStart.year, weekStart.month - 1, weekStart.day);
  const seenSessions = new Set<string>();
  const seenTasks = new Set<string>();
  let taskCount = 0;

  const sessions = input.sessions.map((session, sessionIndex): NormalizedSession => {
    if (!isUuidV4(session.logicalKey) || seenSessions.has(session.logicalKey)) {
      throw new PrototypeDataError(`Økt ${sessionIndex + 1} har ugyldig identitet.`);
    }
    seenSessions.add(session.logicalKey);
    const title = normalizeText(session.title, 120);
    if (!title) throw new PrototypeDataError(`Økt ${sessionIndex + 1} må ha en tittel.`);
    const subject = normalizeText(session.subject, 80);
    const sessionDate = parseDate(session.date, `Økt ${sessionIndex + 1}`);
    const sessionDateMs = Date.UTC(
      sessionDate.year,
      sessionDate.month - 1,
      sessionDate.day,
    );
    const dayOffset = Math.round((sessionDateMs - weekStartMs) / 86_400_000);
    if (dayOffset < 0 || dayOffset > 6) {
      throw new PrototypeDataError(`Økt ${sessionIndex + 1} ligger utenfor valgt uke.`);
    }
    const startsAt = osloLocalDateTimeToIso(session.date, session.startTime);
    const endsAt = osloLocalDateTimeToIso(session.date, session.endTime);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) {
      throw new PrototypeDataError(
        `Sluttidspunktet for økt ${sessionIndex + 1} må være etter starttidspunktet.`,
      );
    }
    if (!Array.isArray(session.tasks) || session.tasks.length > 20) {
      throw new PrototypeDataError(`Økt ${sessionIndex + 1} kan ha opptil 20 oppgaver.`);
    }

    const tasks = session.tasks.map((task, taskIndex): NormalizedTask => {
      taskCount += 1;
      if (taskCount > 100) {
        throw new PrototypeDataError("Ukeplanen kan ikke ha mer enn 100 oppgaver.");
      }
      if (!isUuidV4(task.logicalKey) || seenTasks.has(task.logicalKey)) {
        throw new PrototypeDataError(
          `Oppgave ${taskIndex + 1} i økt ${sessionIndex + 1} har ugyldig identitet.`,
        );
      }
      seenTasks.add(task.logicalKey);
      const taskTitle = normalizeText(task.title, 160);
      if (!taskTitle) {
        throw new PrototypeDataError(
          `Oppgave ${taskIndex + 1} i økt ${sessionIndex + 1} må ha en tittel.`,
        );
      }
      const estimatedMinutes = task.estimatedMinutes ?? null;
      if (
        estimatedMinutes !== null &&
        (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 480)
      ) {
        throw new PrototypeDataError("Tidsestimat må være mellom 1 og 480 minutter.");
      }
      const supportLevel = task.supportLevel ?? 2;
      if (![1, 2, 3].includes(supportLevel)) {
        throw new PrototypeDataError("Støttenivå må være 1, 2 eller 3.");
      }
      return {
        logical_key: task.logicalKey,
        title: taskTitle,
        description: normalizeText(task.description, 4000),
        subject: normalizeText(task.subject ?? subject, 80),
        estimated_minutes: estimatedMinutes,
        support_level: supportLevel,
      };
    });

    return {
      logical_key: session.logicalKey,
      title,
      subject,
      starts_at: startsAt,
      ends_at: endsAt,
      tasks,
    };
  });

  const ordered = [...sessions].sort((first, second) =>
    first.starts_at.localeCompare(second.starts_at),
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (Date.parse(ordered[index].starts_at) < Date.parse(ordered[index - 1].ends_at)) {
      throw new PrototypeDataError("Undervisningsøktene kan ikke overlappe.");
    }
  }

  return { schema_version: "weekly_plan_v1", sessions };
}

function parsePublishResult(
  value: Json,
  expectedRequestId: string,
): WeeklyPlanPublishResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PrototypeDataError();
  }
  const result = value as Record<string, unknown>;
  if (
    result.request_id !== expectedRequestId ||
    !isUuid(String(result.weekly_plan_id)) ||
    !isUuid(String(result.revision_id)) ||
    !Number.isInteger(result.lock_version) ||
    typeof result.already_published !== "boolean" ||
    !Number.isInteger(result.session_count) ||
    !Number.isInteger(result.task_count)
  ) {
    throw new PrototypeDataError();
  }
  return {
    requestId: expectedRequestId,
    weeklyPlanId: String(result.weekly_plan_id),
    revisionId: String(result.revision_id),
    lockVersion: Number(result.lock_version),
    alreadyPublished: result.already_published,
    sessionCount: Number(result.session_count),
    taskCount: Number(result.task_count),
  };
}

export async function publishInitialWeeklyPlan(input: {
  classId: string;
  requestId: string;
  expectedLockVersion: number;
  plan: InitialWeeklyPlanInput;
}): Promise<WeeklyPlanPublishResult> {
  if (!isUuid(input.requestId)) {
    throw new PrototypeDataError("Ugyldig forespørsels-ID.");
  }
  if (input.expectedLockVersion !== 0) {
    throw new PrototypeDataError("Ukeplanen må lastes inn på nytt før publisering.");
  }
  const actor = await requireStaffCapability(input.classId, "plan.publish");
  const candidate = normalizeCandidate(input.plan);
  const semanticHash = createHash("sha256")
    .update(JSON.stringify(candidate))
    .digest("hex");

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("publish_initial_weekly_plan", {
    p_class_id: actor.classId,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_week_start_date: input.plan.weekStartDate,
    p_timezone_name: WEEKLY_PLAN_TIMEZONE,
    p_expected_lock_version: input.expectedLockVersion,
    p_request_id: input.requestId,
    p_semantic_hash: semanticHash,
    p_candidate: candidate,
  });
  if (error || data === null) {
    await requireStaffCapability(input.classId, "plan.publish");
    if (error?.message.includes("already published")) {
      throw new PrototypeDataError(
        "Det finnes allerede en publisert plan for denne uken. Velg en annen uke.",
      );
    }
    if (error?.message.includes("stale")) {
      throw new PrototypeDataError("Ukeplanen er endret. Last siden på nytt.");
    }
    throw new PrototypeDataError("Ukeplanen kunne ikke publiseres.");
  }
  return parsePublishResult(data, input.requestId);
}

export async function getPublishedWeeklyPlanSummaries(
  classId: string,
): Promise<PublishedWeeklyPlanSummary[]> {
  const actor = await requireStaffCapability(classId, "class.workspace.read");
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("weekly_plans")
    .select("id, week_start_date, lock_version, active_revision_id")
    .eq("organization_id", actor.organizationId)
    .eq("class_id", actor.classId)
    .not("active_revision_id", "is", null)
    .order("week_start_date", { ascending: false });
  if (error) throw new PrototypeDataError();
  return data.map((plan) => ({
    id: plan.id,
    weekStartDate: plan.week_start_date,
    lockVersion: plan.lock_version,
  }));
}
