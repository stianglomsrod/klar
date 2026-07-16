import JSZip from "jszip";

const FIXED_ARCHIVE_DATE = new Date("2020-01-01T00:00:00.000Z");

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function createSyntheticWeeklyPlanDocx(
  lines = [
    "Uke 37",
    "Norsk:",
    "- E2E import: les side 12",
    "Matematikk: E2E import: regn oppgave 4.12",
  ],
): Promise<Buffer> {
  const paragraphs = lines
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
    )
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr/></w:body>
</w:document>`;

  const archive = new JSZip();
  const options = { date: FIXED_ARCHIVE_DATE, createFolders: false } as const;
  archive.file("[Content_Types].xml", CONTENT_TYPES, options);
  archive.file("_rels/.rels", ROOT_RELATIONSHIPS, options);
  archive.file("word/document.xml", documentXml, options);
  return archive.generateAsync({
    type: "nodebuffer",
    compression: "STORE",
    platform: "DOS",
  });
}

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
