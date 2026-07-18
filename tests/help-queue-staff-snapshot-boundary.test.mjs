import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("staff help queue snapshot boundary", () => {
  test("reads active order, requests and participants through one atomic RPC", () => {
    const source = readFileSync(
      path.join(root, "src/server/help/help-service.ts"),
      "utf8",
    );
    const start = source.indexOf("export async function getTeacherHelpQueue");
    const end = source.indexOf("export async function openTeacherHelpQueue", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const teacherRead = source.slice(start, end);

    assert.equal(
      [...teacherRead.matchAll(/\.rpc\(\s*["']read_help_queue_staff_snapshot_v2["']/g)]
        .length,
      1,
    );
    assert.doesNotMatch(teacherRead, /readStableActiveQueue/);
    assert.doesNotMatch(
      teacherRead,
      /\.from\(\s*["']help_queue_request_order["']\s*\)/,
    );
    assert.doesNotMatch(
      teacherRead,
      /\.from\(\s*["']help_requests["']\s*\)/,
    );
  });
});
