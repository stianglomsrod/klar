import "server-only";

import { requireAnyStudentActor } from "@/server/auth/authorize";
import { PrototypeDataError } from "@/server/data/errors";
import type { Json, StudentTaskStatus } from "@/server/supabase/database.types";
import { createClient as createSessionClient } from "@/utils/supabase/server";
import type { StudentTodayTask } from "@/server/tasks/task-service";

export type StudentSessionRelation = "previous" | "current" | "next";

export type StudentDaySession = {
  id: string;
  classId: string;
  title: string;
  subject: string | null;
  startsAt: string;
  endsAt: string;
  relation: StudentSessionRelation;
  tasks: StudentTodayTask[];
};

export type StudentSessionDay = {
  referenceAt: string;
  localDate: string;
  timezone: "Europe/Oslo";
  sessions: StudentDaySession[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTask(value: unknown): StudentTodayTask {
  if (!isRecord(value)) throw new PrototypeDataError();
  const status = String(value.status) as StudentTaskStatus;
  if (
    typeof value.assignment_id !== "string" ||
    typeof value.title !== "string" ||
    !(value.description === null || typeof value.description === "string") ||
    !(value.subject === null || typeof value.subject === "string") ||
    !(value.estimated_minutes === null || Number.isInteger(value.estimated_minutes)) ||
    !Number.isInteger(value.support_level) ||
    !Number.isInteger(value.points_value) ||
    !["assigned", "completed", "reopened"].includes(status) ||
    !(value.reopen_message === null || typeof value.reopen_message === "string") ||
    !(value.due_at === null || typeof value.due_at === "string")
  ) {
    throw new PrototypeDataError();
  }
  return {
    assignmentId: value.assignment_id,
    title: value.title,
    description: value.description,
    subject: value.subject,
    estimatedMinutes:
      value.estimated_minutes === null ? null : Number(value.estimated_minutes),
    supportLevel: Number(value.support_level),
    pointsValue: Number(value.points_value),
    status,
    reopenMessage: value.reopen_message,
    dueAt: value.due_at,
  };
}

function parseDay(value: Json): StudentSessionDay {
  if (!isRecord(value) || !Array.isArray(value.sessions)) {
    throw new PrototypeDataError();
  }
  if (
    typeof value.reference_at !== "string" ||
    typeof value.local_date !== "string" ||
    value.timezone !== "Europe/Oslo"
  ) {
    throw new PrototypeDataError();
  }
  const sessions = value.sessions.map((session): StudentDaySession => {
    if (!isRecord(session) || !Array.isArray(session.tasks)) {
      throw new PrototypeDataError();
    }
    const relation = String(session.relation) as StudentSessionRelation;
    if (
      typeof session.id !== "string" ||
      typeof session.class_id !== "string" ||
      typeof session.title !== "string" ||
      !(session.subject === null || typeof session.subject === "string") ||
      typeof session.starts_at !== "string" ||
      typeof session.ends_at !== "string" ||
      !["previous", "current", "next"].includes(relation)
    ) {
      throw new PrototypeDataError();
    }
    return {
      id: session.id,
      classId: session.class_id,
      title: session.title,
      subject: session.subject,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      relation,
      tasks: session.tasks.map(parseTask),
    };
  });
  return {
    referenceAt: value.reference_at,
    localDate: value.local_date,
    timezone: "Europe/Oslo",
    sessions,
  };
}

export async function getOwnStudentSessionDay(): Promise<StudentSessionDay> {
  const actor = await requireAnyStudentActor();
  const sessionClient = await createSessionClient();
  const { data, error } = await sessionClient.rpc("get_my_student_day_v1", {
    p_organization_id: actor.organizationId,
  });
  if (error || data === null) throw new PrototypeDataError();
  return parseDay(data);
}
