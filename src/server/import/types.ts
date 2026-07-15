export type ImportedTask = {
  title: string;
  description: string | null;
  subject: string | null;
  estimatedMinutes: number | null;
  supportLevel: 1 | 2 | 3;
};

export type ImportedPlanPreview = {
  source: "rule-based";
  tasks: ImportedTask[];
  warnings: string[];
};

export type PlanImportInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export interface PlanImporter {
  parse(input: PlanImportInput): Promise<ImportedPlanPreview>;
}

export class PlanImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanImportError";
  }
}

export function isPlanImportError(error: unknown): error is PlanImportError {
  return error instanceof PlanImportError;
}
