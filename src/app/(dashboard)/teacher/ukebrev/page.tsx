"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Loader2,
  FileText,
  CalendarDays,
  Megaphone,
  GraduationCap,
  BookOpen,
  RefreshCw,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { parseWeeklyPlan } from "@/app/actions/parse-weekly-plan";
import type {
  WeeklyPlanData,
  ScheduleEntry,
} from "@/app/actions/parse-weekly-plan";
import { saveWeeklyPlan } from "@/app/actions/save-weekly-plan";
import PreviewScheduleGrid from "@/components/teacher/PreviewScheduleGrid";
import { EditDialog } from "@/components/ui/edit-dialog";
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

type EditState =
  | { type: "message"; index: number; value: string }
  | { type: "goalSubject"; index: number; value: string }
  | { type: "goalItem"; goalIndex: number; itemIndex: number; value: string }
  | { type: "homeworkSubject"; index: number; value: string }
  | { type: "homeworkTask"; hwIndex: number; taskIndex: number; value: string }
  | { type: "schedule"; index: number; entry: ScheduleEntry }
  | null;

const DAY_OPTIONS = [
  { value: 1, label: "Mandag" },
  { value: 2, label: "Tirsdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
];

// ── Component ────────────────────────────────────────

export default function UkebrevPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<WeeklyPlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastVariant, setToastVariant] = useState<"success" | "error">(
    "success",
  );
  const [missingData, setMissingData] = useState<{
    classes: string[];
    subjects: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const DRAFT_KEY = "ukebrev_draft";

  // ── Restore draft from localStorage on mount ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WeeklyPlanData;
        setData(parsed);
        setFileName("(gjenopprettet utkast)");
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
      setToastVariant("error");
      setToastMessage(
        "Kunne ikke lese filen. Har du den åpen i Word? Lukk dokumentet og prøv igjen.",
      );
      setTimeout(() => setToastMessage(null), 5000);
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
  const showToast = useCallback(
    (message: string, variant: "success" | "error" = "success") => {
      setToastVariant(variant);
      setToastMessage(message);
      setTimeout(
        () => setToastMessage(null),
        variant === "error" ? 5000 : 3000,
      );
    },
    [],
  );

  // ── Save handler ──
  const handleSave = useCallback(
    async (forceCreate = false) => {
      if (!data || isSaving) return;
      setIsSaving(true);
      setError(null);
      try {
        const result = await saveWeeklyPlan(data, forceCreate);
        if (result.success) {
          localStorage.removeItem(DRAFT_KEY);
          showToast("Ukebrev og timeplan er lagret!");
          setMissingData(null);
          setTimeout(() => handleReset(), 1500);
        } else if ("missingClasses" in result) {
          // Missing classes/subjects — show confirmation dialog
          setMissingData({
            classes: result.missingClasses,
            subjects: result.missingSubjects,
          });
        } else {
          console.error("Lagringsfeil:", result.error);
          showToast(result.error, "error");
        }
      } catch {
        showToast("Noe gikk galt under lagring. Prøv igjen.", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [data, isSaving, showToast, handleReset],
  );

  // ── Edit state ──────────────────────────────────────

  const [editState, setEditState] = useState<EditState>(null);

  // ── Mutators ────────────────────────────────────────

  const updateMessage = useCallback((index: number, value: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const msgs = [...prev.generalMessages];
      msgs[index] = value;
      return { ...prev, generalMessages: msgs };
    });
  }, []);

  const updateGoalSubject = useCallback((index: number, value: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        learningGoals: prev.learningGoals.map((g, i) =>
          i === index ? { ...g, subject: value } : g,
        ),
      };
    });
  }, []);

  const updateGoalItem = useCallback(
    (goalIdx: number, itemIdx: number, value: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          learningGoals: prev.learningGoals.map((g, i) => {
            if (i !== goalIdx) return g;
            const goals = [...g.goals];
            goals[itemIdx] = value;
            return { ...g, goals };
          }),
        };
      });
    },
    [],
  );

  const updateHomeworkSubject = useCallback((index: number, value: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        homework: prev.homework.map((h, i) =>
          i === index ? { ...h, subject: value } : h,
        ),
      };
    });
  }, []);

  const updateHomeworkTask = useCallback(
    (hwIdx: number, taskIdx: number, value: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          homework: prev.homework.map((h, i) => {
            if (i !== hwIdx) return h;
            const tasks = [...h.tasks];
            tasks[taskIdx] = value;
            return { ...h, tasks };
          }),
        };
      });
    },
    [],
  );

  const updateScheduleEntry = useCallback(
    (index: number, entry: ScheduleEntry) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          schedule: prev.schedule.map((s, i) => (i === index ? entry : s)),
        };
      });
    },
    [],
  );

  const handleEditSave = useCallback(() => {
    if (!editState) return;
    switch (editState.type) {
      case "message":
        updateMessage(editState.index, editState.value);
        break;
      case "goalSubject":
        updateGoalSubject(editState.index, editState.value);
        break;
      case "goalItem":
        updateGoalItem(
          editState.goalIndex,
          editState.itemIndex,
          editState.value,
        );
        break;
      case "homeworkSubject":
        updateHomeworkSubject(editState.index, editState.value);
        break;
      case "homeworkTask":
        updateHomeworkTask(
          editState.hwIndex,
          editState.taskIndex,
          editState.value,
        );
        break;
      case "schedule":
        updateScheduleEntry(editState.index, editState.entry);
        break;
    }
    setEditState(null);
  }, [
    editState,
    updateMessage,
    updateGoalSubject,
    updateGoalItem,
    updateHomeworkSubject,
    updateHomeworkTask,
    updateScheduleEntry,
  ]);

  const editDialogTitle = (() => {
    if (!editState) return "";
    switch (editState.type) {
      case "message":
        return "Rediger beskjed";
      case "goalSubject":
      case "homeworkSubject":
        return "Rediger fag";
      case "goalItem":
        return "Rediger læringsmål";
      case "homeworkTask":
        return "Rediger lekse";
      case "schedule":
        return "Rediger timeplanoppføring";
    }
  })();

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ukebrev</h1>
        <p className="text-slate-500 mt-1">
          Last opp en ukeplan (.docx) og la AI-en analysere innholdet
        </p>
      </div>

      {/* ── Upload Section ── */}
      {!data && !isLoading && (
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
                Last opp ukeplan
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Dra og slipp eller klikk for å velge en .docx-fil
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
              <FileText className="h-4 w-4" />
              Velg fil
            </div>
          </label>
        </div>
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
            AI analyserer ukebrevet...
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
                <h2 className="text-2xl font-bold">Uke {data.weekNumber}</h2>
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

          {/* General Messages */}
          {data.generalMessages.length > 0 && (
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-amber-50 flex items-center gap-2.5">
                <Megaphone className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-slate-800">
                  Beskjeder og informasjon
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {data.generalMessages.map((msg, i) => (
                  <li
                    key={i}
                    className="px-5 py-3 text-slate-700 text-sm hover:bg-amber-50 cursor-pointer transition-colors"
                    onClick={() =>
                      setEditState({ type: "message", index: i, value: msg })
                    }
                  >
                    {msg}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Learning Goals */}
          {data.learningGoals.length > 0 && (
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50 flex items-center gap-2.5">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">Læringsmål</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {data.learningGoals.map((goal, i) => (
                  <div key={i} className="px-5 py-4">
                    <h4
                      className="font-medium text-slate-900 mb-2 hover:text-emerald-700 cursor-pointer transition-colors inline-block"
                      onClick={() =>
                        setEditState({
                          type: "goalSubject",
                          index: i,
                          value: goal.subject,
                        })
                      }
                    >
                      {goal.subject}
                    </h4>
                    <ul className="space-y-1.5">
                      {goal.goals.map((g, j) => (
                        <li
                          key={j}
                          className="text-sm text-slate-600 flex items-start gap-2 hover:bg-emerald-50 cursor-pointer transition-colors rounded-md px-1.5 py-0.5 -mx-1.5"
                          onClick={() =>
                            setEditState({
                              type: "goalItem",
                              goalIndex: i,
                              itemIndex: j,
                              value: g,
                            })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Homework */}
          {data.homework.length > 0 && (
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-blue-50 flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Lekser</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {data.homework.map((hw, i) => (
                  <div key={i} className="px-5 py-4">
                    <h4
                      className="font-medium text-slate-900 mb-2 hover:text-blue-700 cursor-pointer transition-colors inline-block"
                      onClick={() =>
                        setEditState({
                          type: "homeworkSubject",
                          index: i,
                          value: hw.subject,
                        })
                      }
                    >
                      {hw.subject}
                    </h4>
                    <ul className="space-y-1.5">
                      {hw.tasks.map((task, j) => (
                        <li
                          key={j}
                          className="text-sm text-slate-600 flex items-start gap-2 hover:bg-blue-50 cursor-pointer transition-colors rounded-md px-1.5 py-0.5 -mx-1.5"
                          onClick={() =>
                            setEditState({
                              type: "homeworkTask",
                              hwIndex: i,
                              taskIndex: j,
                              value: task,
                            })
                          }
                        >
                          <span className="text-blue-400 mt-0.5">•</span>
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Schedule Grid */}
          {data.schedule.length > 0 && (
            <PreviewScheduleGrid
              schedule={data.schedule}
              onEditEntry={(idx) =>
                setEditState({
                  type: "schedule",
                  index: idx,
                  entry: { ...data.schedule[idx] },
                })
              }
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
              {isSaving ? "Lagrer..." : "Lagre og Publiser"}
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

      {/* ── Edit Dialog ── */}
      <EditDialog
        open={editState !== null}
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

        {/* Schedule entry edit */}
        {editState?.type === "schedule" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fag
              </label>
              <input
                type="text"
                value={editState.entry.subjectName}
                onChange={(e) =>
                  setEditState((prev) =>
                    prev?.type === "schedule"
                      ? {
                          ...prev,
                          entry: { ...prev.entry, subjectName: e.target.value },
                        }
                      : prev,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Klasse
              </label>
              <input
                type="text"
                value={editState.entry.className}
                onChange={(e) =>
                  setEditState((prev) =>
                    prev?.type === "schedule"
                      ? {
                          ...prev,
                          entry: { ...prev.entry, className: e.target.value },
                        }
                      : prev,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dag
              </label>
              <select
                value={editState.entry.dayOfWeek}
                onChange={(e) =>
                  setEditState((prev) =>
                    prev?.type === "schedule"
                      ? {
                          ...prev,
                          entry: {
                            ...prev.entry,
                            dayOfWeek: Number(e.target.value),
                          },
                        }
                      : prev,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors bg-white"
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Starttid
                </label>
                <input
                  type="text"
                  value={editState.entry.startTime}
                  onChange={(e) =>
                    setEditState((prev) =>
                      prev?.type === "schedule"
                        ? {
                            ...prev,
                            entry: {
                              ...prev.entry,
                              startTime: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                  placeholder="08:00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sluttid
                </label>
                <input
                  type="text"
                  value={editState.entry.endTime}
                  onChange={(e) =>
                    setEditState((prev) =>
                      prev?.type === "schedule"
                        ? {
                            ...prev,
                            entry: {
                              ...prev.entry,
                              endTime: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                  placeholder="09:00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </EditDialog>

      {/* ── Missing Data Confirmation Dialog ── */}
      <AlertDialog
        open={!!missingData}
        onOpenChange={(open) => {
          if (!open) setMissingData(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Manglende data i databasen</AlertDialogTitle>
            <AlertDialogDescription>
              Følgende finnes ikke i systemet ennå:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-3 space-y-3 text-sm">
            {missingData && missingData.classes.length > 0 && (
              <div>
                <p className="font-semibold text-slate-800">Klasser:</p>
                <ul className="list-disc list-inside ml-1 mt-0.5">
                  {missingData.classes.map((c) => (
                    <li key={c} className="text-slate-700">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {missingData && missingData.subjects.length > 0 && (
              <div>
                <p className="font-semibold text-slate-800">Fag:</p>
                <ul className="list-disc list-inside ml-1 mt-0.5">
                  {missingData.subjects.map((s) => (
                    <li key={s} className="text-slate-700">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-slate-600">
              Vil du at systemet skal opprette disse for deg nå?
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSave(true)}
              disabled={isSaving}
              autoClose={false}
            >
              {isSaving ? "Oppretter..." : "Ja, opprett og lagre"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
            toastVariant === "error"
              ? "bg-red-600 text-white"
              : "bg-slate-900 text-white"
          }`}
        >
          {toastVariant === "error" ? (
            <AlertCircle className="h-5 w-5 text-red-200" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          )}
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
