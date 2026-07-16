import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  readStudentSupportSettingsAtBoundary,
  resolveStudentSupportSetting,
} from "../src/server/classes/support-read-boundary.ts";

const organizationId = "20000000-0000-4000-8000-000000000001";
const studentId = "10000000-0000-4000-8000-000000000003";
const sensitiveRow = {
  student_id: studentId,
  support_level: 3,
  progress_enabled: true,
};

function resolved(rows) {
  return resolveStudentSupportSetting(
    new Map(rows.map((row) => [row.student_id, row])),
    studentId,
  );
}

describe("staff support read boundary", () => {
  test("does not query and returns neutral values without support capability", async () => {
    let selected = false;
    const result = await readStudentSupportSettingsAtBoundary({
      organizationId,
      studentIds: [studentId],
      authorize: async () => false,
      select: async () => {
        selected = true;
        throw new Error("select must not run");
      },
    });

    assert.equal(selected, false);
    assert.deepEqual(result, { available: false, rows: [] });
    assert.deepEqual(resolved(result.rows), {
      supportLevel: 2,
      progressEnabled: false,
    });
  });

  test("authorizes before and after the scoped service-role read", async () => {
    const events = [];
    const result = await readStudentSupportSettingsAtBoundary({
      organizationId,
      studentIds: [studentId],
      authorize: async () => {
        events.push("authorize");
        return true;
      },
      select: async (scope) => {
        events.push("select");
        assert.deepEqual(scope, { organizationId, studentIds: [studentId] });
        return [sensitiveRow];
      },
    });

    assert.deepEqual(events, ["authorize", "select", "authorize"]);
    assert.equal(result.available, true);
    assert.deepEqual(resolved(result.rows), {
      supportLevel: 3,
      progressEnabled: true,
    });
  });

  test("discards fetched settings when capability disappears", async () => {
    const authorizationResults = [true, false];
    const result = await readStudentSupportSettingsAtBoundary({
      organizationId,
      studentIds: [studentId],
      authorize: async () => authorizationResults.shift(),
      select: async () => [sensitiveRow],
    });

    assert.deepEqual(result, { available: false, rows: [] });
    assert.deepEqual(resolved(result.rows), {
      supportLevel: 2,
      progressEnabled: false,
    });
  });

  test("propagates an ended workspace during the post-read check", async () => {
    let checks = 0;
    await assert.rejects(
      () =>
        readStudentSupportSettingsAtBoundary({
          organizationId,
          studentIds: [studentId],
          authorize: async () => {
            checks += 1;
            if (checks === 1) return true;
            const error = new Error("STAFF_ACCESS_ENDED");
            error.code = "STAFF_ACCESS_ENDED";
            throw error;
          },
          select: async () => [sensitiveRow],
        }),
      (error) => error?.code === "STAFF_ACCESS_ENDED",
    );
  });
});
