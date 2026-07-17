import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isAllowedRole,
  isClassRole,
  isOrganizationRole,
  isUuid,
  requiresAal2,
} from "../src/server/auth/policy.ts";

describe("authorization policy", () => {
  test("accepts only known roles", () => {
    assert.equal(isOrganizationRole("owner"), true);
    assert.equal(isOrganizationRole("admin"), false);
    assert.equal(isClassRole("student"), true);
    assert.equal(isClassRole("owner"), false);
  });

  test("matches explicit role allow-lists", () => {
    assert.equal(isAllowedRole("teacher", ["teacher"]), true);
    assert.equal(isAllowedRole("student", ["teacher"]), false);
  });

  test("requires MFA for elevated roles", () => {
    assert.equal(requiresAal2("owner"), true);
    assert.equal(requiresAal2("teacher"), true);
    assert.equal(requiresAal2("student"), false);
  });

  test("rejects malformed and nil UUIDs", () => {
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), false);
    assert.equal(
      isUuid("550e8400-e29b-41d4-a716-446655440000"),
      true,
    );
  });
});
