import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseWeeklyPlanText } from "../src/server/import/parse-text.ts";

describe("rule-based weekly plan parser", () => {
  test("extracts tasks under Norwegian subject headings", () => {
    const preview = parseWeeklyPlanText(`
      Uke 37
      Norsk:
      - Les side 12 og 13
      - Skriv tre setninger
      Matematikk: Gjør oppgave 4.12
      Fredag:
      Hilsen lærerne
    `);

    assert.deepEqual(
      preview.tasks.map((task) => [task.subject, task.title]),
      [
        ["Norsk", "Les side 12 og 13"],
        ["Norsk", "Skriv tre setninger"],
        ["Matematikk", "Gjør oppgave 4.12"],
      ],
    );
  });

  test("deduplicates repeated tasks", () => {
    const preview = parseWeeklyPlanText("Engelsk:\n- Read page 4\n- Read page 4");
    assert.equal(preview.tasks.length, 1);
  });

  test("falls back to editable suggestions for unstructured text", () => {
    const preview = parseWeeklyPlanText("Øv på ukas ord\nFinn fram leseboka");
    assert.equal(preview.tasks.length, 2);
    assert.equal(preview.warnings.length, 1);
  });
});
