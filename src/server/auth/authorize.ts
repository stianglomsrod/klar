import "server-only";

import { createClient as createSessionClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import { AuthorizationError } from "./errors";
import {
  type AssuranceLevel,
  type ClassRole,
  type OrganizationRole,
  isAllowedRole,
  isClassRole,
  isOrganizationRole,
  isUuid,
  requiresAal2,
} from "./policy";

export type AuthenticatedActor = {
  userId: string;
  assuranceLevel: AssuranceLevel;
};

export type OrganizationAuthorization = AuthenticatedActor & {
  organizationId: string;
  organizationRole: OrganizationRole;
};

export type ClassAuthorization = AuthenticatedActor & {
  organizationId: string;
  classId: string;
  classRole: ClassRole;
};

type ElevatedAccessOptions = {
  enforceMfa?: boolean;
};

function assertResourceId(value: string, label: string): void {
  if (!isUuid(value)) {
    throw new AuthorizationError(
      "INVALID_RESOURCE_ID",
      400,
      `${label} er ikke en gyldig UUID.`,
    );
  }
}

function assertAssuranceLevel(
  actor: AuthenticatedActor,
  role: OrganizationRole | ClassRole,
): void {
  if (requiresAal2(role) && actor.assuranceLevel !== "aal2") {
    throw new AuthorizationError(
      "MFA_REQUIRED",
      403,
      "Denne læreroperasjonen krever tofaktorautentisering.",
    );
  }
}

export async function requireAuthenticatedActor(): Promise<AuthenticatedActor> {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      401,
      "Du må være logget inn.",
    );
  }

  const { data: assurance, error: assuranceError } =
    await sessionClient.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere innloggingsnivået.",
    );
  }

  return {
    userId: user.id,
    assuranceLevel: assurance.currentLevel === "aal2" ? "aal2" : "aal1",
  };
}

export async function requireOrganizationRole(
  organizationId: string,
  allowedRoles: readonly OrganizationRole[],
  options: ElevatedAccessOptions = {},
): Promise<OrganizationAuthorization> {
  assertResourceId(organizationId, "Organisasjons-ID");
  const actor = await requireAuthenticatedActor();
  const admin = getSupabaseAdminClient();
  const { data: membership, error } = await admin
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", actor.userId)
    .maybeSingle();

  if (error) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere organisasjonstilgangen.",
    );
  }

  if (
    !membership ||
    !isOrganizationRole(membership.role) ||
    !isAllowedRole(membership.role, allowedRoles)
  ) {
    throw new AuthorizationError(
      "FORBIDDEN",
      403,
      "Du har ikke tilgang til denne organisasjonen.",
    );
  }

  if (options.enforceMfa !== false) {
    assertAssuranceLevel(actor, membership.role);
  }

  return {
    ...actor,
    organizationId,
    organizationRole: membership.role,
  };
}

export async function requireClassRole(
  classId: string,
  allowedRoles: readonly ClassRole[],
  options: ElevatedAccessOptions = {},
): Promise<ClassAuthorization> {
  assertResourceId(classId, "Klasse-ID");
  const actor = await requireAuthenticatedActor();
  const admin = getSupabaseAdminClient();
  const { data: membership, error } = await admin
    .from("class_memberships")
    .select("organization_id, role")
    .eq("class_id", classId)
    .eq("user_id", actor.userId)
    .maybeSingle();

  if (error) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere klassetilgangen.",
    );
  }

  if (
    !membership ||
    !isUuid(membership.organization_id) ||
    !isClassRole(membership.role) ||
    !isAllowedRole(membership.role, allowedRoles)
  ) {
    throw new AuthorizationError(
      "FORBIDDEN",
      403,
      "Du har ikke tilgang til denne klassen.",
    );
  }

  if (options.enforceMfa !== false) {
    assertAssuranceLevel(actor, membership.role);
  }

  return {
    ...actor,
    organizationId: membership.organization_id,
    classId,
    classRole: membership.role,
  };
}

export async function requireAnyTeacherActor(
  options: ElevatedAccessOptions = {},
): Promise<OrganizationAuthorization> {
  const actor = await requireAuthenticatedActor();
  const admin = getSupabaseAdminClient();
  const { data: membership, error } = await admin
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", actor.userId)
    .in("role", ["owner", "teacher"])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere lærertilgangen.",
    );
  }

  if (
    !membership ||
    !isUuid(membership.organization_id) ||
    !isOrganizationRole(membership.role) ||
    !requiresAal2(membership.role)
  ) {
    throw new AuthorizationError(
      "FORBIDDEN",
      403,
      "Denne operasjonen krever en lærerkonto.",
    );
  }

  if (options.enforceMfa !== false) {
    assertAssuranceLevel(actor, membership.role);
  }

  return {
    ...actor,
    organizationId: membership.organization_id,
    organizationRole: membership.role,
  };
}

export async function requireAnyStudentActor(): Promise<OrganizationAuthorization> {
  const actor = await requireAuthenticatedActor();
  const admin = getSupabaseAdminClient();
  const { data: membership, error } = await admin
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", actor.userId)
    .eq("role", "student")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere elevtilgangen.",
    );
  }

  if (
    !membership ||
    !isUuid(membership.organization_id) ||
    membership.role !== "student"
  ) {
    throw new AuthorizationError(
      "FORBIDDEN",
      403,
      "Denne operasjonen krever en elevkonto.",
    );
  }

  return {
    ...actor,
    organizationId: membership.organization_id,
    organizationRole: "student",
  };
}

export async function requireStudentSelf(
  studentId: string,
): Promise<AuthenticatedActor> {
  assertResourceId(studentId, "Elev-ID");
  const actor = await requireAuthenticatedActor();

  if (actor.userId !== studentId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      403,
      "Eleven kan bare endre sin egen tilstand.",
    );
  }

  return actor;
}
