import "server-only";

import { createClient as createSessionClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import { AuthorizationError } from "./errors";
import {
  type AssuranceLevel,
  type ClassRole,
  type OrganizationRole,
  type StaffCapability,
  isAllowedRole,
  isClassRole,
  isOrganizationRole,
  isStaffCapability,
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

export type StaffAuthorization = AuthenticatedActor & {
  organizationId: string;
  classId: string;
  staffAssignmentId: string;
  capability: StaffCapability;
  capabilities: StaffCapability[];
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

export async function requireStaffIdentity(
  options: ElevatedAccessOptions = {},
): Promise<OrganizationAuthorization> {
  const actor = await requireAuthenticatedActor();
  const admin = getSupabaseAdminClient();
  const { data: membership, error } = await admin
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", actor.userId)
    .in("role", ["owner", "teacher"])
    .order("organization_id")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere ansattilgangen.",
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
      "Denne operasjonen krever en ansattkonto.",
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

async function reconcileExpiredCandidate(
  actorId: string,
  classId: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data: scopes, error: scopesError } = await admin
    .from("staff_assignment_class_scopes")
    .select("assignment_id, organization_id")
    .eq("class_id", classId);
  if (scopesError || scopes.length === 0) return;

  const assignmentIds = scopes.map((scope) => scope.assignment_id);
  const { data: assignments, error: assignmentsError } = await admin
    .from("staff_assignments")
    .select("organization_id, ends_at, revoked_at, expiry_audited_at")
    .eq("user_id", actorId)
    .in("id", assignmentIds);
  if (assignmentsError) return;

  const now = Date.now();
  const organizationIds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.revoked_at === null &&
          assignment.expiry_audited_at === null &&
          assignment.ends_at !== null &&
          Date.parse(assignment.ends_at) <= now,
      )
      .map((assignment) => assignment.organization_id),
  );

  await Promise.all(
    [...organizationIds].map((organizationId) =>
      admin.rpc("reconcile_expired_staff_assignments", {
        p_organization_id: organizationId,
      }),
    ),
  );
}

export async function requireStaffCapability(
  classId: string,
  capability: StaffCapability,
): Promise<StaffAuthorization> {
  assertResourceId(classId, "Klasse-ID");
  if (!isStaffCapability(capability)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      403,
      "Denne handlingen er ikke tilgjengelig.",
    );
  }

  const actor = await requireAuthenticatedActor();
  if (actor.assuranceLevel !== "aal2") {
    throw new AuthorizationError(
      "MFA_REQUIRED",
      403,
      "Denne ansattoperasjonen krever tofaktorautentisering.",
    );
  }

  const admin = getSupabaseAdminClient();
  const { data: staffAssignmentId, error: resolveError } = await admin.rpc(
    "resolve_active_staff_assignment",
    {
      p_actor_id: actor.userId,
      p_class_id: classId,
      p_capability: capability,
    },
  );

  if (resolveError) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke kontrollere ansattoppdraget.",
    );
  }

  if (!staffAssignmentId || !isUuid(staffAssignmentId)) {
    await reconcileExpiredCandidate(actor.userId, classId);
    throw new AuthorizationError(
      "STAFF_ACCESS_ENDED",
      403,
      "Tilgangen til denne klassen er avsluttet.",
    );
  }

  const [{ data: assignment, error: assignmentError }, capabilitiesResult] =
    await Promise.all([
      admin
        .from("staff_assignments")
        .select("organization_id, user_id")
        .eq("id", staffAssignmentId)
        .eq("user_id", actor.userId)
        .single(),
      admin
        .from("staff_assignment_capabilities")
        .select("capability")
        .eq("assignment_id", staffAssignmentId),
    ]);

  if (
    assignmentError ||
    !assignment ||
    !isUuid(assignment.organization_id) ||
    capabilitiesResult.error
  ) {
    throw new AuthorizationError(
      "AUTHORIZATION_LOOKUP_FAILED",
      500,
      "Kunne ikke lese ansattoppdraget.",
    );
  }

  const capabilities = capabilitiesResult.data
    .map((row) => row.capability)
    .filter(isStaffCapability);

  if (!capabilities.includes(capability)) {
    throw new AuthorizationError(
      "STAFF_ACCESS_ENDED",
      403,
      "Tilgangen til denne handlingen er avsluttet.",
    );
  }

  return {
    ...actor,
    organizationId: assignment.organization_id,
    classId,
    staffAssignmentId,
    capability,
    capabilities,
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
    .order("organization_id", { ascending: true })
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
