import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { generateTotp } from "./e2e/support/totp.ts";

describe("E2E TOTP generator", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  test("matches RFC 6238 SHA-1 vectors truncated to six digits", () => {
    assert.equal(generateTotp(rfcSecret, 59_000), "287082");
    assert.equal(generateTotp(rfcSecret, 1_111_111_109_000), "081804");
  });
});
