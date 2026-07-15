import "server-only";

import {
  requireOrganizationRole,
  requireStaffIdentity,
  type OrganizationAuthorization,
} from "@/server/auth/authorize";
import {
  CLASS_PEDAGOGY_PROFILE,
  type AssignableStaffJobLabel,
  type StaffCapability,
  type StaffJobLabel,
  isAssignableStaffJobLabel,
  isStaffCapability,
  isStaffJobLabel,
  isUuid,
} from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { StaffAssignmentSource } from "@/server/supabase/database.types";

export type ActiveStaffClassGrant = {
  assignmentId: string;
  organizationId: string;
  classId: string;
  jobLabel: StaffJobLabel;
  capabilities: StaffCapability[];
};

export type StaffShellContext = {
  organizationId: string;
  organizationName: string;
  displayName: string;
  isOwner: boolean;
};

export type StaffAssignmentStatus =
  | "scheduled"
  | "active"
  | "expired"
  | "revoked";

export type StaffAccessAssignment = {
  id: string;
  personName: string;
  className: string;
  jobLabel: StaffJobLabel;
  source: StaffAssignmentSource;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  status: StaffAssignmentStatus;
};

export type StaffAccessManagement = {
  organizationId: string;
  people: { id: string; displayName: string }[];
  classes: { id: string; name: string }[];
  assignments: StaffAccessAssignment[];
  profileCapabilities: readonly StaffCapability[];
};

function requireValidUuid(value: string, label: string): void {
  if (!isUuid(value)) throw new PrototypeDataError(`${label} er ugyldig.`);
}

async function reconcileExpired(organizationId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("reconcile_expired_staff_assignments", {
    p_organization_id: organizationId,
  });
  if (error) throw new PrototypeDataError("Kunne ikke kontrollere utløpte oppdrag.");
}

export async function getStaffShellContext(): Promise<StaffShellContext> {
  const actor = await requireStaffIdentity();
  const admin = getSupabaseAdminClient();
  const [organizationResult, profileResult] = await Promise.all([
    admin
      .from("organizations")
      .select("name")
      .eq("id", actor.organizationId)
      .single(),
    admin.from("profiles").select("display_name").eq("id", actor.userId).single(),
  ]);
  if (
    organizationResult.error ||
    !organizationResult.data ||
    profileResult.error ||
    !profileResult.data
  ) {
    throw new PrototypeDataError();
  }
  return {
    organizationId: actor.organizationId,
    organizationName: organizationResult.data.name,
    displayName: profileResult.data.display_name,
    isOwner: actor.organizationRole === "owner",
  };
}

export async function listActiveStaffClassGrants(
  actorInput?: OrganizationAuthorization,
): Promise<ActiveStaffClassGrant[]> {
  const actor = actorInput ?? (await requireStaffIdentity());
  await reconcileExpired(actor.organizationId);
  const admin = getSupabaseAdminClient();
  const { data: assignments, error: assignmentsError } = await admin
    .from("staff_assignments")
    .select("id, organization_id, job_label")
    .eq("organization_id", actor.organizationId)
    .eq("user_id", actor.userId);
  if (assignmentsError) throw new PrototypeDataError();
  if (assignments.length === 0) return [];

  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const { data: scopes, error: scopesError } = await admin
    .from("staff_assignment_class_scopes")
    .select("assignment_id, class_id")
    .in("assignment_id", assignments.map((assignment) => assignment.id));
  if (scopesError) throw new PrototypeDataError();

  const classIds = [...new Set(scopes.map((scope) => scope.class_id))];
  const resolutions = await Promise.all(
    classIds.map(async (classId) => {
      const { data, error } = await admin.rpc("resolve_active_staff_assignment", {
        p_actor_id: actor.userId,
        p_class_id: classId,
        p_capability: "class.workspace.read",
      });
      if (error) throw new PrototypeDataError();
      return data ? { classId, assignmentId: data } : null;
    }),
  );
  const active = resolutions.filter(
    (resolution): resolution is { classId: string; assignmentId: string } =>
      resolution !== null && isUuid(resolution.assignmentId),
  );
  if (active.length === 0) return [];

  const activeIds = active.map((resolution) => resolution.assignmentId);
  const { data: capabilityRows, error: capabilitiesError } = await admin
    .from("staff_assignment_capabilities")
    .select("assignment_id, capability")
    .in("assignment_id", activeIds);
  if (capabilitiesError) throw new PrototypeDataError();

  return active.flatMap((resolution) => {
    const assignment = assignmentById.get(resolution.assignmentId);
    if (!assignment || !isStaffJobLabel(assignment.job_label)) return [];
    return [
      {
        assignmentId: assignment.id,
        organizationId: assignment.organization_id,
        classId: resolution.classId,
        jobLabel: assignment.job_label,
        capabilities: capabilityRows
          .filter((row) => row.assignment_id === assignment.id)
          .map((row) => row.capability)
          .filter(isStaffCapability),
      },
    ];
  });
}

function assignmentStatus(input: {
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
}): StaffAssignmentStatus {
  if (input.revokedAt) return "revoked";
  const now = Date.now();
  if (Date.parse(input.startsAt) > now) return "scheduled";
  if (input.endsAt && Date.parse(input.endsAt) <= now) return "expired";
  return "active";
}

export async function getStaffAccessManagement(): Promise<StaffAccessManagement> {
  const identity = await requireStaffIdentity();
  await requireOrganizationRole(identity.organizationId, ["owner"]);
  await reconcileExpired(identity.organizationId);
  const admin = getSupabaseAdminClient();

  const [membershipsResult, classesResult, assignmentsResult] = await Promise.all([
    admin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", identity.organizationId)
      .in("role", ["owner", "teacher"]),
    admin
      .from("classes")
      .select("id, name")
      .eq("organization_id", identity.organizationId)
      .is("archived_at", null)
      .order("name"),
    admin
      .from("staff_assignments")
      .select("id, user_id, job_label, source, starts_at, ends_at, revoked_at")
      .eq("organization_id", identity.organizationId)
      .order("created_at", { ascending: false }),
  ]);
  if (membershipsResult.error || classesResult.error || assignmentsResult.error) {
    throw new PrototypeDataError();
  }

  const adultIds = membershipsResult.data.map((membership) => membership.user_id);
  const profilesResult = adultIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", adultIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new PrototypeDataError();

  const assignmentIds = assignmentsResult.data.map((assignment) => assignment.id);
  const scopesResult = assignmentIds.length
    ? await admin
        .from("staff_assignment_class_scopes")
        .select("assignment_id, class_id")
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };
  if (scopesResult.error) throw new PrototypeDataError();

  const nameByUser = new Map(
    profilesResult.data.map((profile) => [profile.id, profile.display_name]),
  );
  const classNameById = new Map(
    classesResult.data.map((classRow) => [classRow.id, classRow.name]),
  );
  const classByAssignment = new Map(
    scopesResult.data.map((scope) => [scope.assignment_id, scope.class_id]),
  );

  return {
    organizationId: identity.organizationId,
    people: profilesResult.data
      .map((profile) => ({ id: profile.id, displayName: profile.display_name }))
      .sort((first, second) =>
        first.displayName.localeCompare(second.displayName, "nb"),
      ),
    classes: classesResult.data,
    assignments: assignmentsResult.data.flatMap((assignment) => {
      const classId = classByAssignment.get(assignment.id);
      if (!classId || !isStaffJobLabel(assignment.job_label)) return [];
      return [
        {
          id: assignment.id,
          personName: nameByUser.get(assignment.user_id) ?? "Ansatt",
          className: classNameById.get(classId) ?? "Arkivert klasse",
          jobLabel: assignment.job_label,
          source: assignment.source,
          startsAt: assignment.starts_at,
          endsAt: assignment.ends_at,
          revokedAt: assignment.revoked_at,
          status: assignmentStatus({
            startsAt: assignment.starts_at,
            endsAt: assignment.ends_at,
            revokedAt: assignment.revoked_at,
          }),
        },
      ];
    }),
    profileCapabilities: CLASS_PEDAGOGY_PROFILE.capabilities,
  };
}

export async function createStaffAssignment(input: {
  organizationId: string;
  targetUserId: string;
  classId: string;
  jobLabel: AssignableStaffJobLabel;
  startsAt: string;
  endsAt: string;
  idempotencyKey: string;
}): Promise<string> {
  requireValidUuid(input.organizationId, "Organisasjons-ID");
  requireValidUuid(input.targetUserId, "Ansatt-ID");
  requireValidUuid(input.classId, "Klasse-ID");
  requireValidUuid(input.idempotencyKey, "Idempotensnøkkel");
  if (!isAssignableStaffJobLabel(input.jobLabel)) {
    throw new PrototypeDataError("Velg en gyldig jobbetikett.");
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    throw new PrototypeDataError("Sluttidspunktet må være etter starttidspunktet.");
  }

  const actor = await requireOrganizationRole(input.organizationId, ["owner"]);
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_staff_assignment", {
    p_organization_id: actor.organizationId,
    p_actor_id: actor.userId,
    p_target_user_id: input.targetUserId,
    p_class_id: input.classId,
    p_job_label: input.jobLabel,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) {
    throw new PrototypeDataError(
      error?.message.includes("Idempotency key")
        ? "Denne innsendingen er allerede brukt med andre valg. Lukk og prøv igjen."
        : "Kunne ikke opprette oppdraget.",
    );
  }
  return data;
}

export async function revokeStaffAssignment(input: {
  organizationId: string;
  assignmentId: string;
}): Promise<void> {
  requireValidUuid(input.organizationId, "Organisasjons-ID");
  requireValidUuid(input.assignmentId, "Oppdrags-ID");
  const actor = await requireOrganizationRole(input.organizationId, ["owner"]);
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("revoke_staff_assignment", {
    p_organization_id: actor.organizationId,
    p_actor_id: actor.userId,
    p_assignment_id: input.assignmentId,
  });
  if (error) throw new PrototypeDataError("Kunne ikke trekke tilbake oppdraget.");
}
