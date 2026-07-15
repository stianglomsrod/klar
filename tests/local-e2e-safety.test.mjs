import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertLocalSupabaseUrl,
  parseSupabaseEnv,
} from "../scripts/e2e/local-safety.mjs";

describe("local E2E safety", () => {
  test("accepts only the configured loopback Supabase API", () => {
    assert.equal(
      assertLocalSupabaseUrl("http://127.0.0.1:54321/"),
      "http://127.0.0.1:54321",
    );
    assert.equal(
      assertLocalSupabaseUrl("http://localhost:54321"),
      "http://localhost:54321",
    );
  });

  test("rejects linked, encrypted, or unexpected local targets", () => {
    for (const value of [
      "https://abcdefghijklmnopqrst.supabase.co",
      "https://127.0.0.1:54321",
      "http://127.0.0.1:54322",
      "not-a-url",
    ]) {
      assert.throws(() => assertLocalSupabaseUrl(value));
    }
  });

  test("parses quoted CLI environment output and ignores noise", () => {
    assert.deepEqual(
      parseSupabaseEnv(
        'API_URL="http://127.0.0.1:54321"\nANON_KEY="anon"\nnoise\n',
      ),
      { API_URL: "http://127.0.0.1:54321", ANON_KEY: "anon" },
    );
  });
});
