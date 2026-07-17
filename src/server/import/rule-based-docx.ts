import "server-only";

import mammoth from "mammoth";
import type {
  ImportedPlanPreview,
  PlanImporter,
  PlanImportInput,
} from "./types";
import { PlanImportError } from "./types";
import { parseWeeklyPlanText } from "./parse-text";
import {
  DocxSafetyError,
  inspectDocxArchive,
} from "./docx-safety";

export class RuleBasedDocxImporter implements PlanImporter {
  async parse(input: PlanImportInput): Promise<ImportedPlanPreview> {
    validateDocument(input);
    try {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(input.bytes),
      });
      const preview = parseWeeklyPlanText(result.value);
      const mammothWarnings = result.messages
        .filter((message) => message.type === "warning")
        .map(() => "Dokumentet inneholdt formatering som ikke kunne tolkes fullt ut.");
      return {
        ...preview,
        warnings: [...new Set([...preview.warnings, ...mammothWarnings])],
      };
    } catch (error) {
      if (error instanceof PlanImportError) throw error;
      throw new PlanImportError("DOCX-filen kunne ikke leses.");
    }
  }
}

function validateDocument(input: PlanImportInput): void {
  if (!input.fileName.toLocaleLowerCase("nb").endsWith(".docx")) {
    throw new PlanImportError("Smart Import støtter bare DOCX-filer.");
  }
  try {
    inspectDocxArchive(input.bytes);
  } catch (error) {
    if (error instanceof DocxSafetyError) {
      throw new PlanImportError(error.message);
    }
    throw new PlanImportError("Filen ser ikke ut som et gyldig DOCX-dokument.");
  }
}
