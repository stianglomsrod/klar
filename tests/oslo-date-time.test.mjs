import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  OsloDateTimeError,
  osloInstantToLocalDateTime,
  osloLocalDateTimeToIso,
  osloMondayForInstant,
} from "../src/lib/oslo-date-time.ts";

describe("Europe/Oslo school time", () => {
  test("converts winter and summer lessons to UTC", () => {
    assert.equal(
      osloLocalDateTimeToIso("2026-01-12", "09:00"),
      "2026-01-12T08:00:00.000Z",
    );
    assert.equal(
      osloLocalDateTimeToIso("2026-07-13", "09:00"),
      "2026-07-13T07:00:00.000Z",
    );
  });

  test("formats datetime-local values in Oslo independently of process time zone", () => {
    assert.equal(
      osloInstantToLocalDateTime(new Date("2026-01-12T08:00:00.000Z")),
      "2026-01-12T09:00",
    );
    assert.equal(
      osloInstantToLocalDateTime(new Date("2026-07-13T07:00:00.000Z")),
      "2026-07-13T09:00",
    );
  });

  test("rejects missing and ambiguous local times at DST boundaries", () => {
    assert.throws(
      () => osloLocalDateTimeToIso("2026-03-29", "02:30"),
      (error) =>
        error instanceof OsloDateTimeError && /finnes ikke/i.test(error.message),
    );
    assert.throws(
      () => osloLocalDateTimeToIso("2026-10-25", "02:30"),
      (error) =>
        error instanceof OsloDateTimeError && /tvetydig/i.test(error.message),
    );
  });

  test("derives the school week from Oslo across a UTC Sunday boundary", () => {
    assert.equal(
      osloMondayForInstant(new Date("2026-07-19T22:30:00.000Z")),
      "2026-07-20",
    );
  });
});
