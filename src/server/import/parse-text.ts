import type { ImportedPlanPreview, ImportedTask } from "./types.ts";
import { PlanImportError } from "./types.ts";

const MAX_TASKS = 50;

const SUBJECT_ALIASES = new Map<string, string>([
  ["norsk", "Norsk"],
  ["matematikk", "Matematikk"],
  ["matte", "Matematikk"],
  ["engelsk", "Engelsk"],
  ["naturfag", "Naturfag"],
  ["samfunnsfag", "Samfunnsfag"],
  ["krle", "KRLE"],
  ["musikk", "Musikk"],
  ["kroppsøving", "Kroppsøving"],
  ["gym", "Kroppsøving"],
  ["kunst og håndverk", "Kunst og håndverk"],
  ["mat og helse", "Mat og helse"],
]);

const NON_TASK_HEADINGS = new Set([
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
  "søndag",
  "informasjon",
  "beskjeder",
  "ukeplan",
]);

function cleanLine(rawLine: string): { text: string; markedAsTask: boolean } {
  const normalized = rawLine
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  const taskMarker = /^(?:[-*•–—]|\d+[.)]|\[\s?[xX]?\])\s+/;
  return {
    text: normalized.replace(taskMarker, "").trim(),
    markedAsTask: taskMarker.test(normalized),
  };
}

function canonicalSubject(value: string): string | null {
  return SUBJECT_ALIASES.get(value.trim().toLocaleLowerCase("nb")) ?? null;
}

function shouldIgnoreLine(line: string): boolean {
  const lower = line.toLocaleLowerCase("nb").replace(/:$/, "").trim();
  return (
    NON_TASK_HEADINGS.has(lower) ||
    /^uke\s+\d+/i.test(lower) ||
    /^(hei|kjære|hilsen|vennlig hilsen)\b/i.test(lower)
  );
}

function createTask(
  titleInput: string,
  subject: string | null,
  warnings: string[],
): ImportedTask | null {
  const title = titleInput.trim().replace(/\s+/g, " ");
  if (title.length < 2) return null;
  if (title.length > 160) {
    warnings.push(`En oppgavetittel ble forkortet til 160 tegn: ${title.slice(0, 40)}…`);
  }
  return {
    title: title.slice(0, 160),
    description: null,
    subject,
    estimatedMinutes: null,
    supportLevel: 2,
  };
}

function addTask(
  tasks: ImportedTask[],
  seen: Set<string>,
  duplicateWarnings: Set<string>,
  warnings: string[],
  task: ImportedTask,
): void {
  const key = `${task.subject ?? ""}:${task.title}`.toLocaleLowerCase("nb");
  if (seen.has(key) && !duplicateWarnings.has(key)) {
    warnings.push(
      `«${task.title}» forekommer flere ganger. Begge forslagene er beholdt; kontroller om det er tilsiktet.`,
    );
    duplicateWarnings.add(key);
  }
  seen.add(key);
  tasks.push(task);
}

export function parseWeeklyPlanText(text: string): ImportedPlanPreview {
  const warnings: string[] = [];
  const tasks: ImportedTask[] = [];
  const fallbackLines: string[] = [];
  const seen = new Set<string>();
  const duplicateWarnings = new Set<string>();
  let currentSubject: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const { text: line, markedAsTask } = cleanLine(rawLine);
    if (!line) continue;
    fallbackLines.push(line);

    const colonIndex = line.indexOf(":");
    if (colonIndex >= 0) {
      const possibleSubject = canonicalSubject(line.slice(0, colonIndex));
      if (possibleSubject) {
        currentSubject = possibleSubject;
        const inlineTask = line.slice(colonIndex + 1).trim();
        if (!inlineTask) continue;
        const task = createTask(inlineTask, currentSubject, warnings);
        if (task) addTask(tasks, seen, duplicateWarnings, warnings, task);
        if (tasks.length >= MAX_TASKS) break;
        continue;
      }
    }

    const headingSubject = canonicalSubject(line.replace(/:$/, ""));
    if (headingSubject) {
      currentSubject = headingSubject;
      continue;
    }

    if (shouldIgnoreLine(line)) {
      currentSubject = null;
      continue;
    }

    if (!currentSubject && !markedAsTask) continue;
    const task = createTask(line, currentSubject, warnings);
    if (task) addTask(tasks, seen, duplicateWarnings, warnings, task);
    if (tasks.length >= MAX_TASKS) break;
  }

  if (tasks.length === 0) {
    warnings.push(
      "Dokumentet hadde ingen tydelige fagoverskrifter eller punktlister. Kontroller forslagene ekstra nøye.",
    );
    for (const line of fallbackLines) {
      if (shouldIgnoreLine(line)) continue;
      const task = createTask(line, null, warnings);
      if (task) addTask(tasks, seen, duplicateWarnings, warnings, task);
      if (tasks.length >= 10) break;
    }
  }

  if (tasks.length === MAX_TASKS) {
    warnings.push("Forhåndsvisningen er begrenset til 50 oppgaver.");
  }
  if (tasks.length === 0) {
    throw new PlanImportError("Fant ingen oppgaver i dokumentet.");
  }

  return { source: "rule-based", tasks, warnings };
}
