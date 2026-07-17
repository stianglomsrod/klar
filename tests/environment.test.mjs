import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  getPublicSupabaseEnvironment,
  isPilotEnabled,
  isLegacy2xEnabled,
} from "../src/lib/env/public.ts";

const ENVIRONMENT_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_FEATURE_LEGACY_2X",
  "PILOT_ENABLED",
];

const originalEnvironment = new Map(
  ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("public environment", () => {
  test("fails with an actionable error when Supabase configuration is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    assert.throws(
      () => getPublicSupabaseEnvironment(),
      /NEXT_PUBLIC_SUPABASE_URL.*\.env\.example/,
    );
  });

  test("returns validated Supabase configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    assert.deepEqual(getPublicSupabaseEnvironment(), {
      url: "https://example.supabase.co",
      anonKey: "test-anon-key",
    });
  });
});

describe("optional features", () => {
  test("keeps the pilot available unless the kill switch is explicitly off", () => {
    delete process.env.PILOT_ENABLED;
    assert.equal(isPilotEnabled(), true);
    process.env.PILOT_ENABLED = "false";
    assert.equal(isPilotEnabled(), false);
  });

  test("keeps the archived 2.x route tree disabled by default", () => {
    delete process.env.NEXT_PUBLIC_FEATURE_LEGACY_2X;
    assert.equal(isLegacy2xEnabled(), false);
    process.env.NEXT_PUBLIC_FEATURE_LEGACY_2X = "true";
    assert.equal(isLegacy2xEnabled(), true);
  });
});
