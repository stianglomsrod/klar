import "server-only";

import { requireAnyStudentActor } from "@/server/auth/authorize";
import { PrototypeDataError } from "@/server/data/errors";
import type { Json } from "@/server/supabase/database.types";
import { parseStudentTodayTask, type StudentTodayTask } from "./task-service";
import { createClient as createSessionClient } from "@/utils/supabase/server";

export type StudentCatalogTask = StudentTodayTask & {
  visibleFrom: string;
};

export type StudentTaskCatalog = {
  referenceAt: string;
  tasks: StudentCatalogTask[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCatalog(value: Json): StudentTaskCatalog {
  if (
    !isRecord(value) ||
    typeof value.reference_at !== "string" ||
    !Array.isArray(value.tasks)
  ) {
    throw new PrototypeDataError();
  }

  return {
    referenceAt: value.reference_at,
    tasks: value.tasks.map((task) => {
      if (!isRecord(task) || typeof task.visible_from !== "string") {
        throw new PrototypeDataError();
      }
      return {
        ...parseStudentTodayTask(task),
        visibleFrom: task.visible_from,
      };
    }),
  };
}

export async function getOwnStudentTaskCatalog(): Promise<StudentTaskCatalog> {
  const actor = await requireAnyStudentActor();
  const sessionClient = await createSessionClient();
  const { data, error } = await sessionClient.rpc(
    "get_my_student_task_catalog_v1",
    { p_organization_id: actor.organizationId },
  );
  if (error || data === null) throw new PrototypeDataError();
  return parseCatalog(data);
}
