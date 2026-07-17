import "server-only";

import { randomUUID } from "node:crypto";
import { getStudentCodePepper } from "@/lib/env/server";
import { requireClassRole } from "@/server/auth/authorize";
import {
  digestStudentCode,
  generateStudentCode,
  generateStudentPassword,
} from "@/server/auth/student-code";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export type CreatedPrototypeStudent = {
  userId: string;
  displayName: string;
  studentCode: string;
  password: string;
};

export class StudentProvisioningError extends Error {
  constructor(message = "Kunne ikke opprette prototypeeleven.") {
    super(message);
    this.name = "StudentProvisioningError";
  }
}

function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > 80) {
    throw new StudentProvisioningError(
      "Elevnavnet må inneholde mellom 1 og 80 tegn.",
    );
  }
  return normalized;
}

export async function createPrototypeStudent(
  classId: string,
  displayNameInput: string,
): Promise<CreatedPrototypeStudent> {
  const authorization = await requireClassRole(classId, ["teacher"]);
  const displayName = normalizeDisplayName(displayNameInput);
  const admin = getSupabaseAdminClient();
  const password = generateStudentPassword();
  const internalEmail = `student-${randomUUID()}@accounts.klar.invalid`;
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

  if (authError || !authData.user) {
    throw new StudentProvisioningError();
  }

  const userId = authData.user.id;

  try {
    const { error: membershipError } = await admin.from("memberships").insert({
      organization_id: authorization.organizationId,
      user_id: userId,
      role: "student",
      created_by: authorization.userId,
    });
    if (membershipError) throw membershipError;

    const { error: classMembershipError } = await admin
      .from("class_memberships")
      .insert({
        class_id: authorization.classId,
        organization_id: authorization.organizationId,
        user_id: userId,
        role: "student",
        created_by: authorization.userId,
      });
    if (classMembershipError) throw classMembershipError;

    const studentCode = await insertUniqueStudentCode(
      userId,
      authorization.organizationId,
      authorization.userId,
    );

    const { error: auditError } = await admin.from("audit_events").insert({
      organization_id: authorization.organizationId,
      actor_id: authorization.userId,
      event_name: "student.created",
      entity_type: "profile",
      entity_id: userId,
      metadata: { class_id: authorization.classId },
    });
    if (auditError) throw auditError;

    return { userId, displayName, studentCode, password };
  } catch {
    await admin.auth.admin.deleteUser(userId);
    throw new StudentProvisioningError();
  }
}

async function insertUniqueStudentCode(
  userId: string,
  organizationId: string,
  createdBy: string,
): Promise<string> {
  const admin = getSupabaseAdminClient();
  const pepper = getStudentCodePepper();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const studentCode = generateStudentCode();
    const { error } = await admin.from("student_login_codes").insert({
      user_id: userId,
      organization_id: organizationId,
      code_digest: digestStudentCode(studentCode, pepper),
      created_by: createdBy,
    });

    if (!error) return studentCode;
    if (error.code !== "23505") throw error;
  }

  throw new StudentProvisioningError("Kunne ikke generere en unik elevkode.");
}
