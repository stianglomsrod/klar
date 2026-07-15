export const ORGANIZATION_ROLES = ["owner", "teacher", "student"] as const;
export const CLASS_ROLES = ["teacher", "student"] as const;
export const STAFF_JOB_LABELS = [
  "contact_teacher",
  "subject_teacher",
  "special_educator",
  "substitute",
  "legacy_teacher",
  "operational_owner",
] as const;
export const ASSIGNABLE_STAFF_JOB_LABELS = [
  "contact_teacher",
  "subject_teacher",
  "special_educator",
  "substitute",
] as const;
export const STAFF_CAPABILITIES = [
  "class.workspace.read",
  "task.publish",
  "plan.preview",
  "plan.publish",
  "help_queue.manage",
  "student_support.update",
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export const CLASS_PEDAGOGY_V1_CAPABILITIES = [
  "class.workspace.read",
  "task.publish",
  "plan.preview",
  "plan.publish",
  "help_queue.manage",
  "student_support.update",
] as const satisfies readonly StaffCapability[];

export const CLASS_PEDAGOGY_PROFILE = {
  version: "class_pedagogy_v1",
  capabilities: CLASS_PEDAGOGY_V1_CAPABILITIES,
} as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type ClassRole = (typeof CLASS_ROLES)[number];
export type AssuranceLevel = "aal1" | "aal2";
export type StaffJobLabel = (typeof STAFF_JOB_LABELS)[number];
export type AssignableStaffJobLabel =
  (typeof ASSIGNABLE_STAFF_JOB_LABELS)[number];

export type StaffAssignmentGrant = {
  id: string;
  organizationId: string;
  userId: string;
  classId: string;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  capabilities: readonly string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return (
    typeof value === "string" &&
    ORGANIZATION_ROLES.some((role) => role === value)
  );
}

export function isClassRole(value: unknown): value is ClassRole {
  return typeof value === "string" && CLASS_ROLES.some((role) => role === value);
}

export function isStaffJobLabel(value: unknown): value is StaffJobLabel {
  return (
    typeof value === "string" &&
    STAFF_JOB_LABELS.some((label) => label === value)
  );
}

export function isAssignableStaffJobLabel(
  value: unknown,
): value is AssignableStaffJobLabel {
  return (
    typeof value === "string" &&
    ASSIGNABLE_STAFF_JOB_LABELS.some((label) => label === value)
  );
}

export function isStaffCapability(value: unknown): value is StaffCapability {
  return (
    typeof value === "string" &&
    STAFF_CAPABILITIES.some((capability) => capability === value)
  );
}

export function isAllowedRole<Role extends string>(
  actualRole: Role,
  allowedRoles: readonly Role[],
): boolean {
  return allowedRoles.includes(actualRole);
}

export function requiresAal2(role: OrganizationRole | ClassRole): boolean {
  return role === "owner" || role === "teacher";
}

function asTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isActiveStaffAssignment(
  grant: StaffAssignmentGrant,
  now: string,
): boolean {
  const nowTimestamp = asTimestamp(now);
  const startsAt = asTimestamp(grant.startsAt);
  const endsAt = grant.endsAt === null ? null : asTimestamp(grant.endsAt);

  if (nowTimestamp === null || startsAt === null) return false;
  if (grant.endsAt !== null && endsAt === null) return false;
  if (grant.revokedAt !== null) return false;

  return startsAt <= nowTimestamp && (endsAt === null || nowTimestamp < endsAt);
}

export function selectStaffCapabilityGrant(input: {
  actorId: string;
  actorOrganizationRole: OrganizationRole;
  assuranceLevel: AssuranceLevel;
  organizationId: string;
  classId: string;
  capability: string;
  now: string;
  grants: readonly StaffAssignmentGrant[];
}): StaffAssignmentGrant | null {
  if (
    input.assuranceLevel !== "aal2" ||
    !["owner", "teacher"].includes(input.actorOrganizationRole) ||
    !isStaffCapability(input.capability)
  ) {
    return null;
  }

  return (
    input.grants
      .filter(
        (grant) =>
          grant.userId === input.actorId &&
          grant.organizationId === input.organizationId &&
          grant.classId === input.classId &&
          grant.capabilities.includes(input.capability) &&
          isActiveStaffAssignment(grant, input.now),
      )
      .sort((first, second) => {
        const startsDifference =
          (asTimestamp(second.startsAt) ?? 0) -
          (asTimestamp(first.startsAt) ?? 0);
        return startsDifference || first.id.localeCompare(second.id);
      })[0] ?? null
  );
}
