import "server-only";

import { getStudentCodePepper } from "@/lib/env/server";
import { createClient as createSessionClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import { digestStudentCode, normalizeStudentCode } from "./student-code";

export type SignInDestination =
  | "student"
  | "teacher"
  | "mfa-enroll"
  | "mfa-challenge";

export type PrototypeSignInResult =
  | { success: true; destination: SignInDestination }
  | { success: false; error: string };

const GENERIC_SIGN_IN_ERROR = "Ugyldig brukernavn eller passord.";
const DUMMY_STUDENT_EMAIL = "invalid-student@accounts.klar.invalid";

function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : normalizeStudentCode(trimmed);
}

function validCredentialInput(identifier: string, password: string): boolean {
  return (
    identifier.length >= 3 &&
    identifier.length <= 160 &&
    password.length >= 10 &&
    password.length <= 128
  );
}

export async function signInWithPrototypeCredentials(
  identifierInput: string,
  password: string,
): Promise<PrototypeSignInResult> {
  const identifier = normalizeIdentifier(identifierInput);
  if (!validCredentialInput(identifier, password)) {
    return { success: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const sessionClient = await createSessionClient();
  const admin = getSupabaseAdminClient();
  let email = identifier;
  let studentCodeUserId: string | null = null;

  if (!identifier.includes("@")) {
    const codeDigest = digestStudentCode(identifier, getStudentCodePepper());
    const { data: codeRecord } = await admin
      .from("student_login_codes")
      .select("user_id")
      .eq("code_digest", codeDigest)
      .is("disabled_at", null)
      .maybeSingle();

    studentCodeUserId = codeRecord?.user_id ?? null;
    if (studentCodeUserId) {
      const { data: userData } =
        await admin.auth.admin.getUserById(studentCodeUserId);
      email = userData.user?.email ?? DUMMY_STUDENT_EMAIL;
    } else {
      email = DUMMY_STUDENT_EMAIL;
    }
  }

  const { data: signInData, error: signInError } =
    await sessionClient.auth.signInWithPassword({ email, password });

  if (
    signInError ||
    !signInData.user ||
    (studentCodeUserId && signInData.user.id !== studentCodeUserId)
  ) {
    return { success: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", signInData.user.id);

  if (membershipError || !memberships?.length) {
    await sessionClient.auth.signOut();
    return { success: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const hasElevatedRole = memberships.some(
    (membership) =>
      membership.role === "owner" || membership.role === "teacher",
  );
  const hasStudentRole = memberships.some(
    (membership) => membership.role === "student",
  );

  if (studentCodeUserId && !hasStudentRole) {
    await sessionClient.auth.signOut();
    return { success: false, error: GENERIC_SIGN_IN_ERROR };
  }

  if (studentCodeUserId) {
    await admin
      .from("student_login_codes")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", studentCodeUserId);
  }

  if (!hasElevatedRole) {
    return { success: true, destination: "student" };
  }

  const { data: assurance, error: assuranceError } =
    await sessionClient.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError) {
    await sessionClient.auth.signOut();
    return { success: false, error: GENERIC_SIGN_IN_ERROR };
  }

  if (assurance.currentLevel === "aal2") {
    return { success: true, destination: "teacher" };
  }

  return {
    success: true,
    destination:
      assurance.nextLevel === "aal2" ? "mfa-challenge" : "mfa-enroll",
  };
}

export async function signOutPrototypeUser(): Promise<void> {
  const sessionClient = await createSessionClient();
  await sessionClient.auth.signOut();
}
