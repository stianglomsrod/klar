export const MAX_PLAN_FILE_BYTES = 2 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 300;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;

export class DocxSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxSafetyError";
  }
}

function uint16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) throw invalidArchive();
  return view.getUint16(offset, true);
}

function uint32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) throw invalidArchive();
  return view.getUint32(offset, true);
}

function invalidArchive(): DocxSafetyError {
  return new DocxSafetyError("Filen har en ugyldig DOCX-struktur.");
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 22 - 65_535);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (uint32(view, offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw invalidArchive();
}

function assertSafePath(name: string): void {
  const normalized = name.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    segments.includes("..") ||
    normalized.includes("\u0000")
  ) {
    throw new DocxSafetyError("DOCX-filen inneholder en utrygg filsti.");
  }
}

export function inspectDocxArchive(bytes: Uint8Array): void {
  if (bytes.length < 22 || bytes.length > MAX_PLAN_FILE_BYTES) {
    throw new DocxSafetyError("DOCX-filen må være mellom 1 byte og 2 MB.");
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw invalidArchive();

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(view);
  const diskNumber = uint16(view, endOffset + 4);
  const centralDirectoryDisk = uint16(view, endOffset + 6);
  const entriesOnDisk = uint16(view, endOffset + 8);
  const entryCount = uint16(view, endOffset + 10);
  const directorySize = uint32(view, endOffset + 12);
  const directoryOffset = uint32(view, endOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount < 1 ||
    entryCount > MAX_ARCHIVE_ENTRIES ||
    directoryOffset === 0xffffffff ||
    directorySize === 0xffffffff ||
    directoryOffset + directorySize > endOffset
  ) {
    throw invalidArchive();
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const requiredEntries = new Set(["[Content_Types].xml", "word/document.xml"]);
  let offset = directoryOffset;
  let uncompressedTotal = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (uint32(view, offset) !== CENTRAL_DIRECTORY_ENTRY) throw invalidArchive();
    const flags = uint16(view, offset + 8);
    const compressionMethod = uint16(view, offset + 10);
    const compressedSize = uint32(view, offset + 20);
    const uncompressedSize = uint32(view, offset + 24);
    const fileNameLength = uint16(view, offset + 28);
    const extraLength = uint16(view, offset + 30);
    const commentLength = uint16(view, offset + 32);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;

    if (
      nextOffset > directoryOffset + directorySize ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      (flags & 0x0001) !== 0 ||
      (compressionMethod !== 0 && compressionMethod !== 8)
    ) {
      throw invalidArchive();
    }

    let fileName: string;
    try {
      fileName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    } catch {
      throw invalidArchive();
    }
    assertSafePath(fileName);
    requiredEntries.delete(fileName);

    uncompressedTotal += uncompressedSize;
    if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) {
      throw new DocxSafetyError(
        "DOCX-filen blir for stor når den pakkes ut (maks 20 MB).",
      );
    }
    offset = nextOffset;
  }

  if (requiredEntries.size > 0) {
    throw new DocxSafetyError("Filen mangler påkrevd DOCX-innhold.");
  }
}
