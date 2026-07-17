export type StudentSubjectTask = {
  assignmentId: string;
  subject: string | null;
  status: "assigned" | "completed" | "reopened";
  title: string;
  visibleFrom?: string;
};

export type StudentSubjectGroup<Task extends StudentSubjectTask> = {
  key: string;
  name: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  statusLabel: "Ikke startet" | "Godt i gang" | "Se på nytt" | "Alle ferdige";
};

export type StudentSubjectPresentation = {
  emoji: string;
  surface: string;
  border: string;
  accent: string;
  progress: string;
};

const SUBJECT_PRESENTATION: Record<string, StudentSubjectPresentation> = {
  norsk: {
    emoji: "✏️",
    surface: "from-rose-50 to-orange-50",
    border: "border-rose-200",
    accent: "text-rose-900",
    progress: "accent-rose-600",
  },
  matematikk: {
    emoji: "📐",
    surface: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    accent: "text-blue-900",
    progress: "accent-blue-700",
  },
  engelsk: {
    emoji: "💬",
    surface: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    accent: "text-orange-900",
    progress: "accent-orange-600",
  },
  samfunnsfag: {
    emoji: "🌍",
    surface: "from-amber-50 to-orange-50",
    border: "border-amber-200",
    accent: "text-amber-950",
    progress: "accent-amber-700",
  },
  naturfag: {
    emoji: "🌱",
    surface: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    accent: "text-emerald-950",
    progress: "accent-emerald-700",
  },
  krle: {
    emoji: "🕊️",
    surface: "from-violet-50 to-fuchsia-50",
    border: "border-violet-200",
    accent: "text-violet-950",
    progress: "accent-violet-700",
  },
  "kunst og håndverk": {
    emoji: "🎨",
    surface: "from-fuchsia-50 to-violet-50",
    border: "border-fuchsia-200",
    accent: "text-fuchsia-950",
    progress: "accent-fuchsia-700",
  },
  kroppsøving: {
    emoji: "⚽",
    surface: "from-pink-50 to-rose-50",
    border: "border-pink-200",
    accent: "text-pink-950",
    progress: "accent-pink-700",
  },
  "mat og helse": {
    emoji: "🍎",
    surface: "from-emerald-50 to-lime-50",
    border: "border-emerald-200",
    accent: "text-emerald-950",
    progress: "accent-emerald-700",
  },
};

const FALLBACK_PRESENTATION: StudentSubjectPresentation = {
  emoji: "📚",
  surface: "from-slate-50 to-indigo-50",
  border: "border-slate-200",
  accent: "text-slate-950",
  progress: "accent-indigo-700",
};

const subjectCollator = new Intl.Collator("nb-NO", {
  sensitivity: "base",
  numeric: true,
});

function normalizedSubjectIdentity(subject: string | null): string {
  const normalized = subject?.normalize("NFKC").trim().replace(/\s+/g, " ");
  return (normalized || "Andre oppgaver").toLocaleLowerCase("nb-NO");
}

export function normalizeStudentSubject(subject: string | null): string {
  const normalized = subject?.normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized || "Andre oppgaver";
}

function hashSubjectIdentity(identity: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createStudentSubjectKey(subject: string | null): string {
  const identity = normalizedSubjectIdentity(subject);
  const slug = identity
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "oppgaver";
  return `${slug}-${hashSubjectIdentity(identity)}`;
}

export function getStudentSubjectStatusLabel(
  completedCount: number,
  totalCount: number,
  hasReopened = false,
): StudentSubjectGroup<StudentSubjectTask>["statusLabel"] {
  if (hasReopened) return "Se på nytt";
  if (completedCount === 0) return "Ikke startet";
  if (completedCount === totalCount) return "Alle ferdige";
  return "Godt i gang";
}

function taskStatusOrder(status: StudentSubjectTask["status"]): number {
  switch (status) {
    case "reopened":
      return 0;
    case "assigned":
      return 1;
    case "completed":
      return 2;
  }
}

export function groupStudentTasksBySubject<Task extends StudentSubjectTask>(
  tasks: readonly Task[],
): StudentSubjectGroup<Task>[] {
  const grouped = new Map<
    string,
    { name: string; tasksByAssignment: Map<string, Task> }
  >();

  for (const task of tasks) {
    const identity = normalizedSubjectIdentity(task.subject);
    const current = grouped.get(identity) ?? {
      name: normalizeStudentSubject(task.subject),
      tasksByAssignment: new Map<string, Task>(),
    };
    current.tasksByAssignment.set(task.assignmentId, task);
    grouped.set(identity, current);
  }

  return [...grouped.entries()]
    .map(([identity, group]) => {
      const groupedTasks = [...group.tasksByAssignment.values()].sort(
        (first, second) =>
          taskStatusOrder(first.status) - taskStatusOrder(second.status) ||
          (first.visibleFrom ?? "").localeCompare(second.visibleFrom ?? "") ||
          subjectCollator.compare(first.title, second.title) ||
          first.assignmentId.localeCompare(second.assignmentId),
      );
      const completedCount = groupedTasks.filter(
        (task) => task.status === "completed",
      ).length;
      const hasReopened = groupedTasks.some(
        (task) => task.status === "reopened",
      );
      return {
        key: createStudentSubjectKey(identity),
        name: group.name,
        tasks: groupedTasks,
        completedCount,
        totalCount: groupedTasks.length,
        statusLabel: getStudentSubjectStatusLabel(
          completedCount,
          groupedTasks.length,
          hasReopened,
        ),
      };
    })
    .sort((first, second) => subjectCollator.compare(first.name, second.name));
}

export function getStudentSubjectPresentation(
  subject: string,
): StudentSubjectPresentation {
  return (
    SUBJECT_PRESENTATION[normalizedSubjectIdentity(subject)] ??
    FALLBACK_PRESENTATION
  );
}
