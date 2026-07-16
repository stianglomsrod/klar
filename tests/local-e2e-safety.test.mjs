import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertLocalDatabaseUrl,
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

  test("accepts only the local Postgres test database", () => {
    assert.equal(
      assertLocalDatabaseUrl(
        "postgresql://postgres:synthetic@127.0.0.1:54322/postgres",
      ),
      "postgresql://postgres:synthetic@127.0.0.1:54322/postgres",
    );
    for (const value of [
      "postgresql://postgres:secret@db.example.com:5432/postgres",
      "postgresql://postgres:secret@127.0.0.1:54321/postgres",
      "postgresql://postgres:secret@127.0.0.1:54322/pilot",
      "postgresql://postgres:secret@127.0.0.1:54322/postgres?host=db.example.com&port=5432",
      "postgresql://postgres:secret@127.0.0.1:54322/postgres?host=%2Ftmp",
      "postgresql://postgres:secret@127.0.0.1:54322/postgres#host=db.example.com",
      "https://127.0.0.1:54322/postgres",
    ]) {
      assert.throws(() => assertLocalDatabaseUrl(value));
    }
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
