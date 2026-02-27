"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// ── Types ────────────────────────────────────────────

export type MissingDataState = {
  classes: string[];
  subjects: string[];
  /** Only used by ukeplanlegger (lesson-plan) flow */
  grades?: string[];
} | null;

type MissingDataDialogProps = {
  missingData: MissingDataState;
  onOpenChange: (open: boolean) => void;

  /** Editable subject name overrides (original → new name) */
  subjectEdits: Record<string, string>;
  onSubjectEditsChange: (edits: Record<string, string>) => void;

  /** List of subjects the user has chosen to remove */
  deletedSubjects: string[];
  onDeletedSubjectsChange: (deleted: string[]) => void;

  /** Custom class names for grade-based resolution (grade → "7A, 7B") */
  customGradeClasses?: Record<string, string>;
  onCustomGradeClassesChange?: (mapping: Record<string, string>) => void;

  /** Called when user confirms "Ja, opprett og lagre" */
  onConfirm: () => void;
  isSaving: boolean;

  /** Optional description override */
  description?: string;
};

// ── Component ────────────────────────────────────────

export default function MissingDataDialog({
  missingData,
  onOpenChange,
  subjectEdits,
  onSubjectEditsChange,
  deletedSubjects,
  onDeletedSubjectsChange,
  customGradeClasses,
  onCustomGradeClassesChange,
  onConfirm,
  isSaving,
  description,
}: MissingDataDialogProps) {
  const hasGrades = missingData?.grades && missingData.grades.length > 0;

  return (
    <AlertDialog
      open={!!missingData}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Manglende data i databasen</AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              (hasGrades
                ? "Følgende finnes ikke i systemet ennå:"
                : "Følgende finnes ikke i systemet ennå. Du kan redigere fagnavnene eller fjerne fag du ikke trenger før de opprettes.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-3 space-y-3 text-sm overflow-y-auto flex-1 min-h-0">
          {/* ── Grades (ukeplanlegger only) ── */}
          {hasGrades && onCustomGradeClassesChange && customGradeClasses && (
            <div className="space-y-3">
              <p className="font-semibold text-slate-800">
                Trinn uten klasser:
              </p>
              {missingData!.grades!.map((grade) => (
                <div key={grade}>
                  <label className="block text-sm text-slate-700 mb-1">
                    Vi fant ingen klasser for {grade}. trinn. Hvilke klasser vil
                    du opprette?
                  </label>
                  <input
                    type="text"
                    placeholder={`f.eks. ${grade}A, ${grade}B`}
                    value={customGradeClasses[grade] ?? ""}
                    onChange={(e) =>
                      onCustomGradeClassesChange({
                        ...customGradeClasses,
                        [grade]: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Missing classes ── */}
          {missingData && missingData.classes.length > 0 && (
            <div>
              <p className="font-semibold text-slate-800">
                Klasser{hasGrades ? "" : " (opprettes automatisk)"}:
              </p>
              <ul className="list-disc list-inside ml-1 mt-0.5">
                {missingData.classes.map((c) => (
                  <li key={c} className="text-slate-700">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Missing subjects (editable + deletable) ── */}
          {missingData &&
            missingData.subjects.filter((s) => !deletedSubjects.includes(s))
              .length > 0 && (
              <div>
                <p className="font-semibold text-slate-800 mb-1">
                  Fag{hasGrades ? " (rediger eller slett feilaktige)" : ""}:
                </p>
                <div className="space-y-2">
                  {missingData.subjects
                    .filter((s) => !deletedSubjects.includes(s))
                    .map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={subjectEdits[s] ?? s}
                          onChange={(e) =>
                            onSubjectEditsChange({
                              ...subjectEdits,
                              [s]: e.target.value,
                            })
                          }
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onDeletedSubjectsChange([...deletedSubjects, s])
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Fjern fag"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
                {hasGrades && (
                  <p className="text-xs text-slate-500 mt-1">
                    Tips: Slett fag som AI-en har funnet på, eller endre navnet
                    til riktig fag.
                  </p>
                )}
              </div>
            )}

          {/* ── Deleted subjects count ── */}
          {missingData &&
            deletedSubjects.length > 0 &&
            deletedSubjects.length < missingData.subjects.length && (
              <p className="text-xs text-slate-500">
                {deletedSubjects.length} fag fjernet — tilhørende timer droppes.
              </p>
            )}

          {hasGrades && (
            <p className="text-slate-600">
              Vil du at systemet skal opprette disse for deg nå?
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSaving}
            autoClose={false}
          >
            {isSaving ? "Oppretter..." : "Ja, opprett og lagre"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
