import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ASSIGNABLE_STAFF_JOB_LABELS,
  CLASS_PEDAGOGY_PROFILE,
  STAFF_CAPABILITIES,
  isActiveStaffAssignment,
  isAssignableStaffJobLabel,
  isStaffCapability,
  isStaffJobLabel,
  selectStaffCapabilityGrant,
} from "../src/server/auth/policy.ts";

const baseGrant = {
  id: "10000000-0000-4000-8000-000000000001",
  organizationId: "20000000-0000-4000-8000-000000000001",
  userId: "30000000-0000-4000-8000-000000000001",
  classId: "40000000-0000-4000-8000-000000000001",
  startsAt: "2026-07-15T08:00:00.000Z",
  endsAt: "2026-07-15T12:00:00.000Z",
  revokedAt: null,
  capabilities: CLASS_PEDAGOGY_PROFILE.capabilities,
};

function select(overrides = {}) {
  return selectStaffCapabilityGrant({
    actorId: baseGrant.userId,
    actorOrganizationRole: "teacher",
    assuranceLevel: "aal2",
    organizationId: baseGrant.organizationId,
    classId: baseGrant.classId,
    capability: "class.workspace.read",
    now: "2026-07-15T10:00:00.000Z",
    grants: [baseGrant],
    ...overrides,
  });
}

describe("staff assignment policy", () => {
  test("locks the public labels and class pedagogy profile", () => {
    assert.deepEqual(ASSIGNABLE_STAFF_JOB_LABELS, [
      "contact_teacher",
      "subject_teacher",
      "special_educator",
      "substitute",
    ]);
    assert.equal(isStaffJobLabel("legacy_teacher"), true);
    assert.equal(isAssignableStaffJobLabel("legacy_teacher"), false);
    assert.equal(isStaffCapability("student_support.update"), true);
    assert.equal(isStaffCapability("notes.read"), false);
    assert.deepEqual(CLASS_PEDAGOGY_PROFILE.capabilities, [
      "class.workspace.read",
      "task.publish",
      "plan.preview",
      "plan.publish",
      "help_queue.manage",
      "student_support.update",
    ]);
    assert.notEqual(CLASS_PEDAGOGY_PROFILE.capabilities, STAFF_CAPABILITIES);
  });

  test("uses an inclusive start and exclusive end", () => {
    assert.equal(
      isActiveStaffAssignment(baseGrant, "2026-07-15T07:59:59.999Z"),
      false,
    );
    assert.equal(
      isActiveStaffAssignment(baseGrant, "2026-07-15T08:00:00.000Z"),
      true,
    );
    assert.equal(
      isActiveStaffAssignment(baseGrant, "2026-07-15T11:59:59.999Z"),
      true,
    );
    assert.equal(
      isActiveStaffAssignment(baseGrant, "2026-07-15T12:00:00.000Z"),
      false,
    );
  });

  test("lets revocation win and fails closed for malformed time", () => {
    assert.equal(
      isActiveStaffAssignment(
        { ...baseGrant, revokedAt: "2026-07-15T09:00:00.000Z" },
        "2026-07-15T08:30:00.000Z",
      ),
      false,
    );
    assert.equal(isActiveStaffAssignment(baseGrant, "not-a-date"), false);
  });

  test("requires current adult membership, AAL2, scope and known capability", () => {
    assert.equal(select()?.id, baseGrant.id);
    assert.equal(select({ assuranceLevel: "aal1" }), null);
    assert.equal(select({ actorOrganizationRole: "student" }), null);
    assert.equal(select({ classId: "50000000-0000-4000-8000-000000000001" }), null);
    assert.equal(select({ capability: "notes.read" }), null);
  });

  test("selects one deterministic grant when several authorize", () => {
    const newer = {
      ...baseGrant,
      id: "10000000-0000-4000-8000-000000000003",
      startsAt: "2026-07-15T09:00:00.000Z",
    };
    const sameStartLowerId = {
      ...newer,
      id: "10000000-0000-4000-8000-000000000002",
    };
    assert.equal(
      select({ grants: [baseGrant, newer, sameStartLowerId] })?.id,
      sameStartLowerId.id,
    );
  });
});
