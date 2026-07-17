import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getStudentProgressDockLabel } from "../src/lib/student-progress-dock-label.ts";

describe("student progress dock label", () => {
  it("names only the content that is actually available", () => {
    assert.equal(getStudentProgressDockLabel(true, false), "Din fremdrift");
    assert.equal(
      getStudentProgressDockLabel(true, true),
      "Din fremdrift og hjelp",
    );
    assert.equal(getStudentProgressDockLabel(false, true), "Hjelp");
  });
});
