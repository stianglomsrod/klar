import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createClass,
  createStudent,
  deleteClass,
  renameClass,
  renameGrade,
  resetStudentPassword,
  updateStudentClass,
} from "../src/app/actions/student-actions.ts";
import { getSubstituteAccounts } from "../src/app/actions/substitute-actions.ts";

describe("archived 2.x privileged actions", () => {
  test("cannot provision or mutate accounts and classes", async () => {
    const results = await Promise.all([
      createStudent({ fullName: "Test", className: "1A", gradeName: "1" }),
      resetStudentPassword("00000000-0000-4000-8000-000000000000"),
      updateStudentClass("00000000-0000-4000-8000-000000000000", "1A", "1"),
      createClass("1A"),
      renameClass("00000000-0000-4000-8000-000000000000", "1B"),
      renameGrade("00000000-0000-4000-8000-000000000000", "2"),
      deleteClass("00000000-0000-4000-8000-000000000000"),
    ]);

    for (const result of results) {
      assert.deepEqual(result, {
        success: false,
        error: "Klar 2.x er arkivert i 3.0-branchen.",
      });
    }
    assert.deepEqual(await getSubstituteAccounts(), []);
  });
});
