import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  digestStudentCode,
  generateStudentCode,
  generateStudentPassword,
  normalizeStudentCode,
} from "../src/server/auth/student-code.ts";

describe("student prototype credentials", () => {
  test("normalizes codes without changing their meaning", () => {
    assert.equal(normalizeStudentCode("  furu ugle 1234 "), "FURU-UGLE-1234");
    assert.equal(normalizeStudentCode("FURU_UGLE_1234"), "FURU-UGLE-1234");
  });

  test("digests normalized codes with a server-side pepper", () => {
    const pepper = "a-secure-test-pepper-that-is-long-enough";
    const first = digestStudentCode("furu ugle 1234", pepper);
    const second = digestStudentCode("FURU-UGLE-1234", pepper);

    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.notEqual(first, digestStudentCode("FURU-UGLE-1235", pepper));
  });

  test("generates presentable one-time credentials", () => {
    assert.match(generateStudentCode(), /^[A-Z]+-[A-Z]+-[0-9]{4}$/);
    assert.match(generateStudentPassword(), /^[A-Za-z]+-[A-Za-z]+-[0-9]{4}$/);
  });
});
