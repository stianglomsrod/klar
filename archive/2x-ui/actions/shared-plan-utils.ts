"use server";

import {
  normalizeClassName,
  extractGradeNumber,
  splitAndNormalizeSubject,
} from "./shared-normalization";

// ── Types ────────────────────────────────────────────

export type SubjectInfo = {
  parts: string[];
  primary: string;
  fullTitle: string;
};

export type ResolvedAuth = {
  teacherId: string;
};

export type ResolvedClasses = {
  classMap: Map<string, string>; // normalizedName → class_id
  missingClasses: string[];
};

export type ResolvedSubjects = {
  subjectMap: Map<string, string>; // canonicalTitle → subject_id
  missingSubjects: string[];
  subjectInfoMap: Map<string, SubjectInfo>; // rawName → info
};

// ── Auth ──────────────────────────────────────────────

/**
 * Authenticate the current user via Supabase.
 * Returns the teacher's user ID or throws an error string.
 */
export async function authenticateTeacher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<ResolvedAuth> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Ikke autentisert. Logg inn på nytt.");
  }

  return { teacherId: user.id };
}

// ── Class Resolution ─────────────────────────────────

/**
 * Resolve raw class names → class_ids via normalized matching.
 * Returns the mapping and a list of names that weren't found.
 */
export async function resolveClasses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rawClassNames: string[],
): Promise<ResolvedClasses> {
  const normalizedClassSet = new Map<string, string>(); // norm → raw
  for (const raw of rawClassNames) {
    if (raw === "Alle") continue; // handled separately by callers
    normalizedClassSet.set(normalizeClassName(raw), raw);
  }
  const normalizedClassNames = [...normalizedClassSet.keys()];

  const classMap = new Map<string, string>();

  if (normalizedClassNames.length > 0) {
    const { data: allClasses, error } = await supabase
      .from("classes")
      .select("id, name");

    if (error) {
      throw new Error(`Feil ved henting av klasser: ${error.message}`);
    }

    const dbNormMap = new Map<string, { id: string; name: string }>();
    for (const c of allClasses ?? []) {
      dbNormMap.set(normalizeClassName(c.name), { id: c.id, name: c.name });
    }

    for (const norm of normalizedClassNames) {
      const match = dbNormMap.get(norm);
      if (match) classMap.set(norm, match.id);
    }
  }

  const missingClasses = normalizedClassNames.filter((n) => !classMap.has(n));
  return { classMap, missingClasses };
}

// ── Subject Resolution ───────────────────────────────

/**
 * Resolve raw subject names → subject_ids via normalization + splitting.
 * Returns the mapping, a list of missing canonical parts, and an info map.
 */
export async function resolveSubjects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rawSubjectNames: string[],
): Promise<ResolvedSubjects> {
  const subjectInfoMap = new Map<string, SubjectInfo>();
  const allNormalizedParts = new Set<string>();

  for (const raw of rawSubjectNames) {
    const parts = splitAndNormalizeSubject(raw);
    const primary = parts[0];
    const fullTitle = parts.join("/");
    subjectInfoMap.set(raw, { parts, primary, fullTitle });
    for (const p of parts) allNormalizedParts.add(p);
  }

  const partsArray = [...allNormalizedParts];
  const subjectMap = new Map<string, string>();

  if (partsArray.length > 0) {
    const { data: subjects, error } = await supabase
      .from("subjects")
      .select("id, title")
      .in("title", partsArray);

    if (error) {
      throw new Error(`Feil ved henting av fag: ${error.message}`);
    }

    for (const s of subjects ?? []) {
      subjectMap.set(s.title, s.id);
    }
  }

  const missingSubjects = partsArray.filter((n) => !subjectMap.has(n));
  return { subjectMap, missingSubjects, subjectInfoMap };
}

// ── Auto-Create Missing Classes ──────────────────────

/**
 * Insert missing classes with auto-resolved grade_id.
 * Mutates the classMap in-place, adding the newly created entries.
 */
export async function autoCreateClasses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  missingClasses: string[],
  classMap: Map<string, string>,
): Promise<void> {
  if (missingClasses.length === 0) return;

  const gradeCache = new Map<string, string>(); // gradeNumber → grade_id
  const rows: { name: string; grade_id?: string }[] = [];

  for (const norm of missingClasses) {
    const gradeNum =
      extractGradeNumber(norm) ?? norm.match(/^(\d+)/)?.[1] ?? null;
    let gradeId: string | undefined;

    if (gradeNum && !gradeCache.has(gradeNum)) {
      const gradeName = `${gradeNum}. Trinn`;
      const { data: existing } = await supabase
        .from("grades")
        .select("id")
        .ilike("name", gradeName)
        .limit(1)
        .single();

      if (existing) {
        gradeCache.set(gradeNum, existing.id);
      } else {
        const { data: created } = await supabase
          .from("grades")
          .insert({ name: gradeName })
          .select("id")
          .single();
        if (created) gradeCache.set(gradeNum, created.id);
      }
    }

    if (gradeNum) gradeId = gradeCache.get(gradeNum);
    rows.push(gradeId ? { name: norm, grade_id: gradeId } : { name: norm });
  }

  const { data: created, error: createError } = await supabase
    .from("classes")
    .insert(rows)
    .select("id, name");

  if (createError) {
    throw new Error(`Feil ved opprettelse av klasser: ${createError.message}`);
  }

  for (const c of created ?? []) {
    classMap.set(normalizeClassName(c.name), c.id);
  }
}

// ── Auto-Create Missing Subjects ─────────────────────

/**
 * Insert missing subjects.
 * Mutates the subjectMap in-place, adding the newly created entries.
 */
export async function autoCreateSubjects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  missingSubjects: string[],
  teacherId: string,
  subjectMap: Map<string, string>,
): Promise<void> {
  if (missingSubjects.length === 0) return;

  for (const name of missingSubjects) {
    const { data: newSubject, error: createError } = await supabase
      .from("subjects")
      .insert({ title: name, created_by: teacherId })
      .select("id")
      .single();

    if (createError) {
      throw new Error(
        `Feil ved opprettelse av fag «${name}»: ${createError.message}`,
      );
    }

    subjectMap.set(name, newSubject.id);
  }
}
