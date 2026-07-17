import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createStudentSubjectKey,
  getStudentSubjectPresentation,
  groupStudentTasksBySubject,
  normalizeStudentSubject,
} from "../src/lib/student-subjects.ts";

function task(overrides) {
  return {
    assignmentId: crypto.randomUUID(),
    subject: "Norsk",
    status: "assigned",
    title: "Les",
    visibleFrom: "2026-07-17T08:00:00.000Z",
    ...overrides,
  };
}

describe("student subject catalog", () => {
  it("normalizes whitespace and case without losing assignment identity", () => {
    const first = task({ assignmentId: "10000000-0000-4000-8000-000000000001" });
    const second = task({
      assignmentId: "10000000-0000-4000-8000-000000000002",
      subject: "  norsk  ",
      status: "completed",
      title: "Les",
    });

    const groups = groupStudentTasksBySubject([first, second, second]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].name, "Norsk");
    assert.equal(groups[0].totalCount, 2);
    assert.equal(groups[0].completedCount, 1);
    assert.equal(groups[0].statusLabel, "Godt i gang");
    assert.deepEqual(
      groups[0].tasks.map((candidate) => candidate.assignmentId),
      [first.assignmentId, second.assignmentId],
    );
  });

  it("keeps completed and reopened work visible in a calm order", () => {
    const groups = groupStudentTasksBySubject([
      task({ assignmentId: "10000000-0000-4000-8000-000000000003", status: "completed" }),
      task({ assignmentId: "10000000-0000-4000-8000-000000000004", status: "assigned" }),
      task({ assignmentId: "10000000-0000-4000-8000-000000000005", status: "reopened" }),
    ]);

    assert.deepEqual(
      groups[0].tasks.map((candidate) => candidate.status),
      ["reopened", "assigned", "completed"],
    );
    assert.equal(groups[0].totalCount, 3);
    assert.equal(groups[0].statusLabel, "Se på nytt");
  });

  it("uses a stable fallback and separates ordinary slug collisions", () => {
    assert.equal(normalizeStudentSubject("   "), "Andre oppgaver");
    assert.equal(
      createStudentSubjectKey("  KROPPSØVING "),
      createStudentSubjectKey("kroppsøving"),
    );
    assert.notEqual(
      createStudentSubjectKey("Kunst & håndverk"),
      createStudentSubjectKey("Kunst håndverk"),
    );
    assert.match(createStudentSubjectKey("Kroppsøving"), /^kroppsoving-[0-9a-f]{8}$/);
  });

  it("gives known and unknown subjects text-safe presentations", () => {
    assert.equal(getStudentSubjectPresentation("Naturfag").emoji, "🌱");
    assert.equal(getStudentSubjectPresentation("Egendefinert").emoji, "📚");
  });
});
