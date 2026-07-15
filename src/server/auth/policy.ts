export const ORGANIZATION_ROLES = ["owner", "teacher", "student"] as const;
export const CLASS_ROLES = ["teacher", "student"] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type ClassRole = (typeof CLASS_ROLES)[number];
export type AssuranceLevel = "aal1" | "aal2";

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

export function isAllowedRole<Role extends string>(
  actualRole: Role,
  allowedRoles: readonly Role[],
): boolean {
  return allowedRoles.includes(actualRole);
}

export function requiresAal2(role: OrganizationRole | ClassRole): boolean {
  return role === "owner" || role === "teacher";
}
