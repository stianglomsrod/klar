import "server-only";

import { requireAnyStudentActor } from "@/server/auth/authorize";
import { PrototypeDataError } from "@/server/data/errors";
import type { Json } from "@/server/supabase/database.types";
import { createClient as createSessionClient } from "@/utils/supabase/server";
import {
  parseStudentTodayTask,
  type StudentTodayTask,
} from "@/server/tasks/task-service";

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
      tasks: session.tasks.map(parseStudentTodayTask),
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
