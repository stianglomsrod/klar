import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRecipientPreview } from "../src/lib/task-iteration-copy.ts";

describe("task iteration recipient preview", () => {
  it("shows every name when at most three recipients are selected", () => {
    assert.equal(formatRecipientPreview([]), "");
    assert.equal(formatRecipientPreview(["Ada"]), "Ada");
    assert.equal(
      formatRecipientPreview(["Ada", "Bo", "Cato"]),
      "Ada, Bo, Cato",
    );
  });

  it("keeps a 200-recipient confirmation compact", () => {
    const names = Array.from({ length: 200 }, (_, index) => `Elev ${index + 1}`);
    assert.equal(
      formatRecipientPreview(names),
      "Elev 1, Elev 2, Elev 3 og 197 til",
    );
  });
});
