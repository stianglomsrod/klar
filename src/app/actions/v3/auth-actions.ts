"use server";

import { redirect } from "next/navigation";

import {
  signInWithPrototypeCredentials,
  signOutPrototypeUser,
  type PrototypeSignInResult,
} from "@/server/auth/sign-in";
import {
  beginTeacherMfaEnrollment,
  verifyTeacherMfa,
  type MfaEnrollmentResult,
  type MfaVerificationResult,
} from "@/server/auth/mfa";
import { isAuthorizationError } from "@/server/auth/errors";

export async function signInPrototypeAction(
  identifier: string,
  password: string,
): Promise<PrototypeSignInResult> {
  return signInWithPrototypeCredentials(identifier, password);
}

export async function signOutPrototypeAction(): Promise<void> {
  await signOutPrototypeUser();
  redirect("/login");
}

export async function beginTeacherMfaEnrollmentAction(): Promise<MfaEnrollmentResult> {
  try {
    return await beginTeacherMfaEnrollment();
  } catch (error) {
    return {
      success: false,
      error: isAuthorizationError(error)
        ? error.message
        : "Kunne ikke starte MFA-oppsettet.",
    };
  }
}

export async function verifyTeacherMfaAction(
  code: string,
  factorId?: string,
): Promise<MfaVerificationResult> {
  try {
    return await verifyTeacherMfa(code, factorId);
  } catch (error) {
    return {
      success: false,
      error: isAuthorizationError(error)
        ? error.message
        : "Kunne ikke bekrefte MFA-koden.",
    };
  }
}
