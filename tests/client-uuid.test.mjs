import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createClientUuid } from "../src/lib/client-uuid.ts";

describe("client UUID", () => {
  test("uses native randomUUID when the context exposes it", () => {
    const expected = "12345678-1234-4234-9234-123456789abc";
    const actual = createClientUuid({
      randomUUID: () => expected,
      getRandomValues: () => {
        throw new Error("Fallbacken skal ikke brukes.");
      },
    });

    assert.equal(actual, expected);
  });

  test("creates an RFC 4122 version 4 UUID without randomUUID", () => {
    const actual = createClientUuid({
      getRandomValues: (values) => {
        values.forEach((_, index) => {
          values[index] = index;
        });
        return values;
      },
    });

    assert.equal(actual, "00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});
