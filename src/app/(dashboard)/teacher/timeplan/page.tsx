"use client";

import { useState, useRef, useCallback } from "react";
import WeeklyScheduleEditor from "@/components/teacher/WeeklyScheduleEditor";
import {
  AlertCircle,
  Upload,
  Loader2,
} from "lucide-react";
import { parseWeeklyPlan } from "@/app/actions/parse-weekly-plan";
import type {
  ScheduleEntry,
  WeeklyPlanData,
} from "@/app/actions/parse-weekly-plan";
import { normalizeClassName } from "@/app/actions/shared-normalization";
import { saveWeeklyPlan } from "@/app/actions/save-weekly-plan";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import MissingDataDialog from "@/components/teacher/MissingDataDialog";
import ScheduleEntryEditDialog from "@/components/teacher/ScheduleEntryEditDialog";
import { useClassStudentSelection } from "./useClassStudentSelection";
import ClassStudentSelector from "./ClassStudentSelector";
import UploadPreviewPanel from "./UploadPreviewPanel";

export default function TimeplanPage() {
  // ── Class / student / week selection (extracted) ──
  const {
    classes,
    selectedClassId,
    studentSearch,
    setStudentSearch,
    selectedStudentId,
    selectedWeek,
    setSelectedWeek,
    mode,
    loading,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownRef,
    currentWeek,
    filteredStudents,
    selectedClassName,
    handleModeChange,
    handleWeekChange,
    handleClassSelect,
    handleStudentSelect,
    clearStudentSelection,
  } = useClassStudentSelection();

  // ── Upload flow state ──
  const [uploadedSchedule, setUploadedSchedule] = useState<
    ScheduleEntry[] | null
  >(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);
  const [missingData, setMissingData] = useState<{
    classes: string[];
    subjects: string[];
  } | null>(null);
  const [uploadWeeklyData, setUploadWeeklyData] =
    useState<WeeklyPlanData | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  type ScheduleEditState = { index: number; entry: ScheduleEntry } | null;
  const [scheduleEditState, setScheduleEditState] =
    useState<ScheduleEditState>(null);

  // ── Interactive missing-data edit state ──
  const [subjectEdits, setSubjectEdits] = useState<Record<string, string>>({});
  const [deletedSubjects, setDeletedSubjects] = useState<string[]>([]);

  // ── Import masterplan toggle ──
  const [alsoSaveAsMasterplan, setAlsoSaveAsMasterplan] = useState(false);

  // ── Class mapping dialog state ──
  const [classMapInfo, setClassMapInfo] = useState<{
    documentClasses: string[];
    rawSchedule: ScheduleEntry[];
    rawWeeklyData: WeeklyPlanData;
  } | null>(null);

  // ── Upload flow helpers ──

  /** Filter schedule to a single class and remap className → selectedClassName */
  const applyClassFilter = useCallback(
    (
      schedule: ScheduleEntry[],
      weeklyData: WeeklyPlanData,
      docClassName: string,
    ) => {
      const normalizedFilter = normalizeClassName(docClassName);
      const filtered = schedule.filter(
        (e) =>
          !e.className ||
          e.className === "Alle" ||
          normalizeClassName(e.className) === normalizedFilter,
      );
      const remapped = filtered.map((e) => ({
        ...e,
        className: selectedClassName || e.className,
      }));
      setUploadedSchedule(remapped);
      setUploadWeeklyData({ ...weeklyData, schedule: remapped });
      setClassMapInfo(null);
    },
    [selectedClassName],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (file.size === 0) {
        showToast(
          "Kunne ikke lese filen. Har du den åpen i Word? Lukk dokumentet og prøv igjen.",
          "error",
        );
        return;
      }

      setUploadError(null);
      setUploadedSchedule(null);
      setUploadWeeklyData(null);
      setIsParsing(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await parseWeeklyPlan(formData);

        if (!result.success) {
          setUploadError(result.error);
          return;
        }

        // Extract schedule entries — works for both ukebrev (has schedule[]) and ukeplanlegger
        let schedule: ScheduleEntry[] = [];
        if (result.data.documentType === "ukebrev") {
          schedule = result.data.schedule;
        }

        if (schedule.length === 0) {
          setUploadError(
            "Ingen timeplanoppføringer funnet i dokumentet. Prøv et ukebrev med timeplan.",
          );
          return;
        }

        // Build base WeeklyPlanData (schedule retains original classNames)
        const weeklyDataBase: WeeklyPlanData = {
          documentType: "ukebrev",
          weekNumber: mode === "master" ? 0 : selectedWeek,
          generalMessages:
            result.data.documentType === "ukebrev"
              ? result.data.generalMessages
              : [],
          learningGoals:
            result.data.documentType === "ukebrev"
              ? result.data.learningGoals
              : [],
          homework:
            result.data.documentType === "ukebrev" ? result.data.homework : [],
          schedule,
        };

        // ── Smart class matching ──
        const docClassNames = [
          ...new Set(
            schedule.map((e) => e.className).filter((n) => n && n !== "Alle"),
          ),
        ];
        const normalizedSelected = normalizeClassName(selectedClassName || "");

        // Find which doc class matches the selected class
        const matchedDocClass = docClassNames.find(
          (dc) => normalizeClassName(dc) === normalizedSelected,
        );

        if (docClassNames.length === 0 || matchedDocClass) {
          // Exact match (or "Alle" only) → filter & remap to selected class
          const filterName = matchedDocClass || "Alle";
          applyClassFilter(schedule, weeklyDataBase, filterName);
        } else if (docClassNames.length === 1) {
          // Only one class in doc, no match → auto-select it but ask first
          setClassMapInfo({
            documentClasses: docClassNames,
            rawSchedule: schedule,
            rawWeeklyData: weeklyDataBase,
          });
        } else {
          // Multiple classes, none match → show mapping dialog
          setClassMapInfo({
            documentClasses: docClassNames,
            rawSchedule: schedule,
            rawWeeklyData: weeklyDataBase,
          });
        }
      } catch {
        setUploadError("Noe gikk galt ved parsing. Prøv igjen.");
      } finally {
        setIsParsing(false);
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      }
    },
    [selectedClassName, selectedWeek, mode, showToast, applyClassFilter],
  );

  const handleUploadReset = useCallback(() => {
    setUploadedSchedule(null);
    setUploadWeeklyData(null);
    setUploadError(null);
    setScheduleEditState(null);
    setClassMapInfo(null);
  }, []);

  const handleClassMapSelect = useCallback(
    (docClassName: string) => {
      if (!classMapInfo) return;
      applyClassFilter(
        classMapInfo.rawSchedule,
        classMapInfo.rawWeeklyData,
        docClassName,
      );
    },
    [classMapInfo, applyClassFilter],
  );

  const updateScheduleEntry = useCallback(
    (index: number, entry: ScheduleEntry) => {
      setUploadedSchedule((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[index] = entry;
        return next;
      });
      setUploadWeeklyData((prev) => {
        if (!prev) return prev;
        const schedule = [...prev.schedule];
        schedule[index] = entry;
        return { ...prev, schedule };
      });
    },
    [],
  );

  const handleScheduleEditSave = useCallback(() => {
    if (!scheduleEditState) return;
    updateScheduleEntry(scheduleEditState.index, scheduleEditState.entry);
    setScheduleEditState(null);
  }, [scheduleEditState, updateScheduleEntry]);

  const handleSaveSchedule = useCallback(
    async (forceCreate = false) => {
      if (!uploadWeeklyData || isSaving) return;
      setIsSaving(true);
      try {
        // Apply subject edits and deletions before saving
        let dataToSave = uploadWeeklyData;
        if (
          forceCreate &&
          (deletedSubjects.length > 0 || Object.keys(subjectEdits).length > 0)
        ) {
          dataToSave = {
            ...uploadWeeklyData,
            schedule: uploadWeeklyData.schedule
              .filter((e) => !deletedSubjects.includes(e.subjectName))
              .map((e) => {
                const newName = subjectEdits[e.subjectName];
                if (newName && newName.trim())
                  return { ...e, subjectName: newName.trim() };
                return e;
              }),
          };
        }

        const result = await saveWeeklyPlan(
          dataToSave,
          forceCreate,
          alsoSaveAsMasterplan,
        );
        if (result.success) {
          showToast(
            `Timeplan lagret! ${result.stats.scheduleEntries} timer opprettet.`,
          );
          handleUploadReset();
          setMissingData(null);
          setSubjectEdits({});
          setDeletedSubjects([]);
          // Bump key to force WeeklyScheduleEditor to re-fetch
          setEditorRefreshKey((k) => k + 1);
        } else if ("missingClasses" in result) {
          setMissingData({
            classes: result.missingClasses,
            subjects: result.missingSubjects,
          });
          setSubjectEdits({});
          setDeletedSubjects([]);
        } else {
          showToast(result.error, "error");
        }
      } catch {
        showToast("Noe gikk galt under lagring. Prøv igjen.", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [
      uploadWeeklyData,
      isSaving,
      showToast,
      handleUploadReset,
      deletedSubjects,
      subjectEdits,
      alsoSaveAsMasterplan,
    ],
  );

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-600 text-sm">Laster inn klasser...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-slate-900 mr-2">
            Timeplan
          </h1>
          {selectedStudentId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Individuell plan:{" "}
              {filteredStudents.find((s) => s.id === selectedStudentId)
                ?.full_name || "Elev"}
            </span>
          )}
        </div>

        <ClassStudentSelector
          classes={classes}
          selectedClassId={selectedClassId}
          onClassSelect={handleClassSelect}
          studentSearch={studentSearch}
          onStudentSearchChange={setStudentSearch}
          selectedStudentId={selectedStudentId}
          filteredStudents={filteredStudents}
          isDropdownOpen={isDropdownOpen}
          onDropdownOpenChange={setIsDropdownOpen}
          dropdownRef={dropdownRef}
          onStudentSelect={handleStudentSelect}
          onClearStudent={clearStudentSelection}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => handleModeChange("master")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              mode === "master"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Fast timeplan
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("weekly")}
            className={`px-4 py-2 text-sm font-semibold border-l border-slate-200 transition-colors ${
              mode === "weekly"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Ukevisning
          </button>
        </div>

        {mode === "weekly" && (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Uke</span>
            <div className="inline-flex items-center rounded-lg border border-slate-200 shadow-sm bg-white">
              <button
                type="button"
                onClick={() => handleWeekChange(selectedWeek - 1)}
                className="px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                aria-label="Forrige uke"
              >
                –
              </button>
              <input
                type="number"
                min={1}
                max={53}
                value={selectedWeek}
                onChange={(e) =>
                  handleWeekChange(parseInt(e.target.value || "1", 10))
                }
                className="w-16 text-center border-l border-r border-slate-200 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleWeekChange(selectedWeek + 1)}
                className="px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                aria-label="Neste uke"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Upload button — always visible when a class is selected */}
        {selectedClassId && !uploadedSchedule && !isParsing && (
          <>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
              }}
              className="hidden"
              id="schedule-upload"
            />
            <label
              htmlFor="schedule-upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors shadow-sm"
            >
              <Upload className="h-4 w-4" />
              Last opp timeplan (.docx)
            </label>
          </>
        )}
        {isParsing && (
          <div className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI analyserer...
          </div>
        )}
      </div>

      {mode === "master" && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900 mb-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500" />
          <div>
            Du redigerer nå grunnmuren. Endringer her påvirker alle vanlige
            uker.
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium text-sm">
              Feil ved analysering
            </p>
            <p className="text-red-600 text-sm mt-1">{uploadError}</p>
            <button
              onClick={handleUploadReset}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
            >
              Prøv igjen
            </button>
          </div>
        </div>
      )}

      {/* ── Uploaded schedule preview ── */}
      {uploadedSchedule && uploadedSchedule.length > 0 && (
        <UploadPreviewPanel
          schedule={uploadedSchedule}
          className={selectedClassName}
          mode={mode}
          weekNumber={selectedWeek}
          alsoSaveAsMasterplan={alsoSaveAsMasterplan}
          onAlsoSaveAsMasterplanChange={setAlsoSaveAsMasterplan}
          isSaving={isSaving}
          onEditEntry={(idx) =>
            setScheduleEditState({
              index: idx,
              entry: { ...uploadedSchedule[idx] },
            })
          }
          onSave={() => handleSaveSchedule()}
          onReset={handleUploadReset}
        />
      )}

      {/* ── Schedule editor (hidden while previewing upload) ── */}
      {selectedClassId && !uploadedSchedule && (
        <WeeklyScheduleEditor
          key={editorRefreshKey}
          classId={selectedClassId}
          studentId={selectedStudentId || undefined}
          mode={mode}
          externalWeekNumber={selectedWeek}
          onWeekNumberChange={(w) => {
            if (mode === "weekly")
              setSelectedWeek(Math.max(1, Math.min(53, w)));
          }}
          hideWeekSelector
          highlightOverrides={mode === "weekly"}
        />
      )}

      {/* ── Edit Dialog for uploaded schedule entries ── */}
      <ScheduleEntryEditDialog
        editState={scheduleEditState}
        onClose={() => setScheduleEditState(null)}
        onSave={handleScheduleEditSave}
        onChange={(entry) =>
          setScheduleEditState((prev) => (prev ? { ...prev, entry } : prev))
        }
      />

      {/* ── Class Mapping Dialog ── */}
      <AlertDialog
        open={!!classMapInfo}
        onOpenChange={(open) => {
          if (!open) setClassMapInfo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Velg klasse fra dokumentet</AlertDialogTitle>
            <AlertDialogDescription>
              Fant ikke{" "}
              <span className="font-semibold text-slate-900">
                {selectedClassName}
              </span>{" "}
              i dokumentet. Følgende planer ble funnet:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-1 space-y-2">
            {classMapInfo?.documentClasses.map((dc) => (
              <button
                key={dc}
                type="button"
                onClick={() => handleClassMapSelect(dc)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm font-medium text-slate-800"
              >
                <span>{dc}</span>
                <span className="text-xs text-slate-500">
                  Importer til {selectedClassName}
                </span>
              </button>
            ))}
          </div>
          <AlertDialogFooter className="mt-3">
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Missing Data Dialog (interactive) ── */}
      <MissingDataDialog
        missingData={missingData}
        onOpenChange={(open) => {
          if (!open) {
            setMissingData(null);
            setSubjectEdits({});
            setDeletedSubjects([]);
          }
        }}
        subjectEdits={subjectEdits}
        onSubjectEditsChange={setSubjectEdits}
        deletedSubjects={deletedSubjects}
        onDeletedSubjectsChange={setDeletedSubjects}
        onConfirm={() => handleSaveSchedule(true)}
        isSaving={isSaving}
      />

      {/* ── Toast ── */}
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
