"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Loader2,
  FileText,
  CalendarDays,
  RefreshCw,
  Save,
  X,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { parseWeeklyPlan } from "@/app/actions/parse-weekly-plan";
import type { ParsedDocument } from "@/app/actions/parse-weekly-plan";
import { saveWeeklyPlan } from "@/app/actions/save-weekly-plan";
import { saveLessonPlan } from "@/app/actions/save-lesson-plan";
import PreviewLessonPlan from "@/components/teacher/PreviewLessonPlan";
import { EditDialog } from "@/components/ui/edit-dialog";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import MissingDataDialog from "@/components/teacher/MissingDataDialog";
import ScheduleEntryEditDialog from "@/components/teacher/ScheduleEntryEditDialog";
import OnboardingGuide from "./OnboardingGuide";
import { useUkebrevMutators } from "./useUkebrevMutators";
import UkebrevPreview from "./UkebrevPreview";

// ── Component ────────────────────────────────────────

export default function UkebrevPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [missingData, setMissingData] = useState<{
    classes: string[];
    subjects: string[];
    grades: string[];
  } | null>(null);
  const [customGradeClasses, setCustomGradeClasses] = useState<
    Record<string, string>
  >({});
  const [subjectEdits, setSubjectEdits] = useState<Record<string, string>>({});
  const [deletedSubjects, setDeletedSubjects] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const DRAFT_KEY = "planlegging_draft";

  // ── Restore draft from localStorage on mount ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ParsedDocument;
        if (
          parsed.documentType === "ukebrev" ||
          parsed.documentType === "ukeplanlegger"
        ) {
          setData(parsed);
          setFileName("(gjenopprettet utkast)");
        }
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // ── Sync edits to localStorage ──
  useEffect(() => {
    if (data) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch {
        /* quota exceeded — ignore */
      }
    }
  }, [data]);

  // ── Upload handler ──
  const handleFile = useCallback(async (file: File) => {
    // Guard: locked or empty file (e.g. open in Word)
    if (file.size === 0) {
      showToast(
        "Kunne ikke lese filen. Har du den åpen i Word? Lukk dokumentet og prøv igjen.",
        "error",
      );
      return;
    }

    setFileName(file.name);
    setError(null);
    setData(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await parseWeeklyPlan(formData);

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleFile(file);
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // ── Reset handler ──
  const handleReset = useCallback(() => {
    setData(null);
    setError(null);
    setFileName(null);
    setIsLoading(false);
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // ── Toast handler ──
  // ── Save handler ──
  const handleSave = useCallback(
    async (forceCreate = false) => {
      if (!data || isSaving) return;
      setIsSaving(true);
      setError(null);
      try {
        // Apply subject corrections before saving (ukeplanlegger only)
        let saveData = data;
        if (
          forceCreate &&
          data.documentType === "ukeplanlegger" &&
          (deletedSubjects.length > 0 || Object.keys(subjectEdits).length > 0)
        ) {
          const cleaned = {
            ...data,
            tasks: data.tasks
              .filter((t) => !deletedSubjects.includes(t.subjectName))
              .map((t) => {
                const newName = subjectEdits[t.subjectName];
                if (newName && newName.trim()) {
                  return { ...t, subjectName: newName.trim() };
                }
                return t;
              }),
          };
          saveData = cleaned;
          setData(cleaned);
        }

        if (saveData.documentType === "ukeplanlegger") {
          const result = await saveLessonPlan(
            saveData,
            forceCreate,
            forceCreate ? customGradeClasses : undefined,
          );
          if (result.success) {
            localStorage.removeItem(DRAFT_KEY);
            if (result.unmatchedSessions.length > 0) {
              showToast(
                `Lagret! ${result.stats.tasksCreated} oppgaver opprettet. ${result.unmatchedSessions.length} økter ble ikke koblet til timeplanen.`,
              );
            } else {
              showToast(
                `Lagret! ${result.stats.tasksCreated} oppgaver opprettet og ${result.stats.scheduleLinked} koblet til timeplanen.`,
              );
            }
            setMissingData(null);
            setTimeout(() => handleReset(), 2000);
          } else if ("missingClasses" in result) {
            setMissingData({
              classes: result.missingClasses,
              subjects: result.missingSubjects,
              grades: result.missingGrades,
            });
            setCustomGradeClasses({});
            setSubjectEdits({});
            setDeletedSubjects([]);
          } else {
            showToast(result.error, "error");
          }
        } else {
          const result = await saveWeeklyPlan(saveData, forceCreate);
          if (result.success) {
            localStorage.removeItem(DRAFT_KEY);
            showToast("Ukebrev og timeplan er lagret!");
            setMissingData(null);
            setTimeout(() => handleReset(), 2000);
          } else if ("missingClasses" in result) {
            setMissingData({
              classes: result.missingClasses,
              subjects: result.missingSubjects,
              grades: [],
            });
          } else {
            showToast(result.error, "error");
          }
        }
      } catch {
        showToast("Noe gikk galt under lagring. Prøv igjen.", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [
      data,
      isSaving,
      showToast,
      handleReset,
      customGradeClasses,
      subjectEdits,
      deletedSubjects,
    ],
  );

  // ── Edit state + mutators (extracted) ──
  const {
    editState,
    setEditState,
    handleEditSave,
    editDialogTitle,
    updateLessonTask,
  } = useUkebrevMutators(setData);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Planer</h1>
        <p className="text-slate-500 mt-1">
          Last opp et ukebrev eller undervisningsplan (.docx) — AI-en
          klassifiserer og analyserer automatisk
        </p>
      </div>

      {/* ── Upload Section ── */}
      {!data && !isLoading && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center bg-white transition-colors ${
              isDragOver
                ? "border-indigo-500 bg-indigo-50/50"
                : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
              id="docx-upload"
            />
            <label
              htmlFor="docx-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  Last opp dokument
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Dra og slipp eller klikk for å velge en .docx-fil (ukebrev
                  eller undervisningsplan)
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                <FileText className="h-4 w-4" />
                Velg fil
              </div>
            </label>
          </div>

          {/* ── Onboarding Guide ── */}
          <OnboardingGuide />
        </>
      )}

      {/* ── Error State ── */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Feil ved analysering</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={handleReset}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Prøv igjen
            </button>
          </div>
        </div>
      )}

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-700 font-medium mt-4">
            AI analyserer dokumentet...
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {fileName && (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {fileName}
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── Preview Section ── */}
      {data && (
        <div className="space-y-6">
          {/* Week Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 opacity-80" />
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">Uke {data.weekNumber}</h2>
                  <span className="text-xs font-medium bg-white/20 rounded-full px-2.5 py-0.5">
                    {data.documentType === "ukebrev"
                      ? "📨 Ukebrev"
                      : "📋 Ukeplanlegger"}
                  </span>
                </div>
                <p className="text-indigo-100 text-sm mt-0.5">
                  Analysert fra {fileName}
                </p>
                <p className="text-indigo-200 text-xs mt-1 flex items-center gap-1">
                  <Pencil className="h-3 w-3" />
                  Klikk på tekst for å redigere
                </p>
              </div>
            </div>
          </div>

          {/* ── Ukebrev Preview ── */}
          {data.documentType === "ukebrev" && (
            <UkebrevPreview data={data} onEdit={setEditState} />
          )}

          {/* ── Ukeplanlegger Preview ── */}
          {data.documentType === "ukeplanlegger" && (
            <PreviewLessonPlan
              tasks={data.tasks}
              onUpdateTask={updateLessonTask}
            />
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => handleSave()}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {isSaving
                ? "Lagrer..."
                : data.documentType === "ukeplanlegger"
                  ? "Lagre oppgaver"
                  : "Lagre og Publiser"}
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium"
            >
              <X className="h-5 w-5" />
              Avbryt / Prøv på nytt
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Dialog (ukebrev text edits only) ── */}
      {data?.documentType === "ukebrev" && (
        <EditDialog
          open={editState !== null && editState.type !== "schedule"}
          onClose={() => setEditState(null)}
          title={editDialogTitle}
          onSave={handleEditSave}
        >
          {/* Text-based edits (messages, subjects, goals, tasks) */}
          {editState && editState.type !== "schedule" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {editState.type === "message"
                  ? "Beskjed"
                  : editState.type === "goalSubject" ||
                      editState.type === "homeworkSubject"
                    ? "Fagnavn"
                    : editState.type === "goalItem"
                      ? "Læringsmål"
                      : "Oppgave"}
              </label>
              {editState.type === "message" ? (
                <textarea
                  value={editState.value}
                  onChange={(e) =>
                    setEditState((prev) =>
                      prev && prev.type !== "schedule"
                        ? { ...prev, value: e.target.value }
                        : prev,
                    )
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                />
              ) : (
                <input
                  type="text"
                  value={editState.value}
                  onChange={(e) =>
                    setEditState((prev) =>
                      prev && prev.type !== "schedule"
                        ? { ...prev, value: e.target.value }
                        : prev,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                />
              )}
            </div>
          )}
        </EditDialog>
      )}

      {/* ── Schedule Entry Edit Dialog ── */}
      <ScheduleEntryEditDialog
        editState={
          editState?.type === "schedule"
            ? { index: editState.index, entry: editState.entry }
            : null
        }
        onClose={() => setEditState(null)}
        onSave={handleEditSave}
        onChange={(entry) =>
          setEditState((prev) =>
            prev?.type === "schedule" ? { ...prev, entry } : prev,
          )
        }
        showClassName
      />

      {/* ── Missing Data Confirmation Dialog ── */}
      <MissingDataDialog
        missingData={missingData}
        onOpenChange={(open) => {
          if (!open) {
            setMissingData(null);
            setCustomGradeClasses({});
            setSubjectEdits({});
            setDeletedSubjects([]);
          }
        }}
        subjectEdits={subjectEdits}
        onSubjectEditsChange={setSubjectEdits}
        deletedSubjects={deletedSubjects}
        onDeletedSubjectsChange={setDeletedSubjects}
        customGradeClasses={customGradeClasses}
        onCustomGradeClassesChange={setCustomGradeClasses}
        onConfirm={() => handleSave(true)}
        isSaving={isSaving}
        description="Følgende finnes ikke i systemet ennå:"
      />

      {/* ── Toast ── */}
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
