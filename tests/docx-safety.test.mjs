import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DocxSafetyError,
  inspectDocxArchive,
} from "../src/server/import/docx-safety.ts";

function createArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(entry.uncompressedSize ?? 0, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.flags ?? 0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(entry.uncompressedSize ?? 0, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]));
}

const REQUIRED_ENTRIES = [
  { name: "[Content_Types].xml", uncompressedSize: 128 },
  { name: "word/document.xml", uncompressedSize: 1024 },
];

describe("DOCX archive safety inspection", () => {
  test("accepts a small archive with required DOCX entries", () => {
    assert.doesNotThrow(() => inspectDocxArchive(createArchive(REQUIRED_ENTRIES)));
  });

  test("rejects a suspicious uncompressed size", () => {
    const archive = createArchive([
      REQUIRED_ENTRIES[0],
      { name: "word/document.xml", uncompressedSize: 21 * 1024 * 1024 },
    ]);
    assert.throws(
      () => inspectDocxArchive(archive),
      (error) =>
        error instanceof DocxSafetyError && /pakkes ut.*20 MB/.test(error.message),
    );
  });

  test("rejects traversal paths and encrypted entries", () => {
    assert.throws(
      () =>
        inspectDocxArchive(
          createArchive([...REQUIRED_ENTRIES, { name: "../outside.xml" }]),
        ),
      /utrygg filsti/,
    );
    assert.throws(
      () =>
        inspectDocxArchive(
          createArchive([
            REQUIRED_ENTRIES[0],
            { ...REQUIRED_ENTRIES[1], flags: 1 },
          ]),
        ),
      /ugyldig DOCX-struktur/,
    );
  });
});
