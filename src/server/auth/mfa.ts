import "server-only";

import { createClient as createSessionClient } from "@/utils/supabase/server";
import { requireStaffIdentity } from "./authorize";

export type MfaEnrollmentResult =
  | {
      success: true;
      factorId: string;
      qrCode: string;
      secret: string;
    }
  | { success: false; error: string };

export type MfaVerificationResult =
  | { success: true }
  | { success: false; error: string };

export async function beginTeacherMfaEnrollment(): Promise<MfaEnrollmentResult> {
  await requireStaffIdentity({ enforceMfa: false });
  const sessionClient = await createSessionClient();
  const { data: factors, error: factorError } =
    await sessionClient.auth.mfa.listFactors();

  if (factorError) {
    return { success: false, error: "Kunne ikke kontrollere MFA-oppsettet." };
  }

  if (factors.totp.length > 0) {
    return {
      success: false,
      error: "Kontoen har allerede en aktiv autentiseringsfaktor.",
    };
  }

  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await sessionClient.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await sessionClient.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Klar lærer",
    issuer: "Klar",
  });

  if (error) {
    return { success: false, error: "Kunne ikke starte MFA-oppsettet." };
  }

  return {
    success: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyTeacherMfa(
  code: string,
  requestedFactorId?: string,
): Promise<MfaVerificationResult> {
  await requireStaffIdentity({ enforceMfa: false });
  if (!/^\d{6}$/.test(code)) {
    return { success: false, error: "Koden må bestå av seks siffer." };
  }

  const sessionClient = await createSessionClient();
  const { data: factors, error: factorError } =
    await sessionClient.auth.mfa.listFactors();

  if (factorError) {
    return { success: false, error: "Kunne ikke kontrollere MFA-oppsettet." };
  }

  const factor = requestedFactorId
    ? factors.all.find(
        (candidate) =>
          candidate.id === requestedFactorId && candidate.factor_type === "totp",
      )
    : factors.totp[0];

  if (!factor) {
    return { success: false, error: "Fant ingen autentiseringsfaktor." };
  }

  const { error } = await sessionClient.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });

  if (error) {
    return { success: false, error: "Koden er ugyldig eller utløpt." };
  }

  return { success: true };
}
