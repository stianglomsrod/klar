"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import WeeklyScheduleEditor from "@/components/teacher/WeeklyScheduleEditor";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  User,
  RotateCcw,
  AlertCircle,
  Upload,
  Loader2,
  FileText,
  Save,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { parseWeeklyPlan } from "@/app/actions/parse-weekly-plan";
import type {
  ScheduleEntry,
  WeeklyPlanData,
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

type Class = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  full_name: string | null;
  class_id: string;
  class_name: string;
};

export default function TimeplanPage() {
  const getISOWeekNumber = (date: Date): number => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const currentWeek = getISOWeekNumber(new Date());

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [mode, setMode] = useState<"master" | "weekly">("weekly");
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const pendingStudentRef = useRef<Student | null>(null);

  // ── Upload flow state ──
  const [uploadedSchedule, setUploadedSchedule] = useState<
    ScheduleEntry[] | null
  >(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">(
    "success",
  );
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

  const DAY_OPTIONS = [
    { value: 1, label: "Mandag" },
    { value: 2, label: "Tirsdag" },
    { value: 3, label: "Onsdag" },
    { value: 4, label: "Torsdag" },
    { value: 5, label: "Fredag" },
  ];

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const supabase = createClient();

  const handleModeChange = (nextMode: "master" | "weekly") => {
    setMode(nextMode);
    if (nextMode === "master") {
      setSelectedWeek(0);
    } else {
      setSelectedWeek((prev) => (prev <= 0 ? currentWeek : prev));
    }
  };

  const handleWeekChange = (week: number) => {
    const clamped = Math.max(1, Math.min(53, week));
    setSelectedWeek(clamped);
  };

  const handleClassSelect = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStudentId("");
    setStudentSearch("");
    updateUrlParams(classId, undefined);
  };

  const handleStudentSelect = (student: Student) => {
    pendingStudentRef.current = student;
    ensureClassInList(student.class_id, student.class_name);
    setSelectedClassId(student.class_id);
    setSelectedStudentId(student.id);
    setStudentSearch(student.full_name || "");
    setIsDropdownOpen(false);
    updateUrlParams(student.class_id, student.id);
  };

  const updateUrlParams = (nextClassId?: string, nextStudentId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextClassId) {
      params.set("classId", nextClassId);
    } else {
      params.delete("classId");
    }

    if (nextStudentId) {
      params.set("studentId", nextStudentId);
    } else {
      params.delete("studentId");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      (s.full_name || "").toLowerCase().includes(term),
    );
  }, [students, studentSearch]);

  const ensureClassInList = (classId: string, className: string) => {
    if (!classId) return;
    setClasses((prev) => {
      const exists = prev.some((c) => c.id === classId);
      if (exists) return prev;
      return [...prev, { id: classId, name: className || "Ukjent klasse" }];
    });
  };

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, []);

  useEffect(() => {
    const classParam = searchParams.get("classId");
    if (classParam && classParam !== selectedClassId) {
      setSelectedClassId(classParam);
    }

    if (!classParam && !selectedClassId && classes.length > 0) {
      const firstClass = classes[0].id;
      setSelectedClassId(firstClass);
      updateUrlParams(firstClass, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, classes]);

  useEffect(() => {
    const studentParam = searchParams.get("studentId");
    if (!studentParam) {
      if (selectedStudentId) setSelectedStudentId("");
      return;
    }

    if (studentParam === selectedStudentId) return;

    const found = students.find((s) => s.id === studentParam);
    if (found) {
      pendingStudentRef.current = found;
      ensureClassInList(found.class_id, found.class_name);
      setSelectedClassId(found.class_id);
      setSelectedStudentId(found.id);
      setStudentSearch(found.full_name || "");
      return;
    }

    // If student not found yet, keep the id but wait for data to load
    setSelectedStudentId(studentParam);
  }, [searchParams, students, selectedStudentId]);

  useEffect(() => {
    if (!selectedClassId) return;

    if (
      pendingStudentRef.current &&
      pendingStudentRef.current.class_id === selectedClassId
    ) {
      const student = pendingStudentRef.current;
      setSelectedStudentId(student.id);
      setStudentSearch(student.full_name || "");
      pendingStudentRef.current = null;
    } else {
      setSelectedStudentId("");
      setStudentSearch("");
    }

    setIsDropdownOpen(false);
  }, [selectedClassId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");
      if (error) throw error;

      setClasses(data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, student_profiles!inner(class_id, classes(name))",
        )
        .eq("role", "student")
        .order("full_name");

      if (error) throw error;

      const mapped: Student[] = (data || []).map((row) => {
        // Supabase may return the join as a single object or an array; normalize to first entry
        const raw = (row as any).student_profiles;
        const sp = Array.isArray(raw) ? raw[0] : raw || undefined;
        return {
          id: row.id,
          full_name: row.full_name,
          class_id: sp?.class_id || "",
          class_name: sp?.classes?.name || "",
        };
      });

      setStudents(mapped);

      // Ensure any class discovered via student_profiles exists in the dropdown options
      mapped.forEach((s) => ensureClassInList(s.class_id, s.class_name));
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // ── Upload flow helpers ──

  const selectedClassName =
    classes.find((c) => c.id === selectedClassId)?.name || "";

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

        // Override class names and week number with page selections
        const overridden = schedule.map((e) => ({
          ...e,
          className: selectedClassName || e.className,
        }));

        setUploadedSchedule(overridden);

        // Build full WeeklyPlanData for save — use selected week, empty non-schedule fields
        const weeklyData: WeeklyPlanData = {
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
          schedule: overridden,
        };
        setUploadWeeklyData(weeklyData);
      } catch {
        setUploadError("Noe gikk galt ved parsing. Prøv igjen.");
      } finally {
        setIsParsing(false);
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      }
    },
    [selectedClassName, selectedWeek, mode, showToast],
  );

  const handleUploadReset = useCallback(() => {
    setUploadedSchedule(null);
    setUploadWeeklyData(null);
    setUploadError(null);
    setScheduleEditState(null);
  }, []);

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
        const result = await saveWeeklyPlan(uploadWeeklyData, forceCreate);
        if (result.success) {
          showToast(
            `Timeplan lagret! ${result.stats.scheduleEntries} timer opprettet.`,
          );
          handleUploadReset();
          setMissingData(null);
          // Bump key to force WeeklyScheduleEditor to re-fetch
          setEditorRefreshKey((k) => k + 1);
        } else if ("missingClasses" in result) {
          setMissingData({
            classes: result.missingClasses,
            subjects: result.missingSubjects,
          });
        } else {
          showToast(result.error, "error");
        }
      } catch {
        showToast("Noe gikk galt under lagring. Prøv igjen.", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [uploadWeeklyData, isSaving, showToast, handleUploadReset],
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

        <div className="flex flex-wrap items-end gap-3" ref={dropdownRef}>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="class-select"
              className="text-sm font-medium text-slate-700"
            >
              Velg klasse
            </label>
            <select
              id="class-select"
              value={selectedClassId}
              onChange={(e) => handleClassSelect(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium w-[160px]"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Søk elev
            </label>
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              {selectedStudentId && (
                <button
                  type="button"
                  onClick={() => {
                    pendingStudentRef.current = null;
                    setSelectedStudentId("");
                    setStudentSearch("");
                    setIsDropdownOpen(false);
                    updateUrlParams(selectedClassId, undefined);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsDropdownOpen(false);
                }}
                placeholder="Skriv navn..."
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              {isDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredStudents.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      Ingen elever funnet
                    </div>
                  )}
                  {filteredStudents.map((student) => {
                    const active = selectedStudentId === student.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          handleStudentSelect(student);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 ${
                          active
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-800"
                        }`}
                      >
                        <User className="h-4 w-4" />
                        <span className="truncate">
                          {student.full_name || "Uten navn"}
                          {student.class_name ? ` (${student.class_name})` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedStudentId && (
            <button
              type="button"
              onClick={() => {
                pendingStudentRef.current = null;
                setSelectedStudentId("");
                setStudentSearch("");
                setIsDropdownOpen(false);
                updateUrlParams(selectedClassId, undefined);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Tilbake til{" "}
              {classes.find((c) => c.id === selectedClassId)?.name || "klassen"}
            </button>
          )}
        </div>
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
        <div className="space-y-4 mb-4">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-500 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-7 w-7 opacity-80" />
              <div>
                <h2 className="text-lg font-bold">
                  Forhåndsvisning — {selectedClassName || "Timeplan"}
                  {mode === "weekly"
                    ? `, uke ${selectedWeek}`
                    : " (fast timeplan)"}
                </h2>
                <p className="text-purple-100 text-xs mt-0.5 flex items-center gap-1">
                  <Pencil className="h-3 w-3" />
                  Klikk på en time for å redigere
                </p>
              </div>
            </div>
          </div>

          <PreviewScheduleGrid
            schedule={uploadedSchedule}
            onEditEntry={(idx) =>
              setScheduleEditState({
                index: idx,
                entry: { ...uploadedSchedule[idx] },
              })
            }
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleSaveSchedule()}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {isSaving ? "Lagrer..." : "Lagre timeplan"}
            </button>
            <button
              onClick={handleUploadReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium"
            >
              <X className="h-5 w-5" />
              Forkast
            </button>
          </div>
        </div>
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
      <EditDialog
        open={scheduleEditState !== null}
        onClose={() => setScheduleEditState(null)}
        title="Rediger timeplanoppføring"
        onSave={handleScheduleEditSave}
      >
        {scheduleEditState && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fag
              </label>
              <input
                type="text"
                value={scheduleEditState.entry.subjectName}
                onChange={(e) =>
                  setScheduleEditState((prev) =>
                    prev
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
                Dag
              </label>
              <select
                value={scheduleEditState.entry.dayOfWeek}
                onChange={(e) =>
                  setScheduleEditState((prev) =>
                    prev
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
                  value={scheduleEditState.entry.startTime}
                  onChange={(e) =>
                    setScheduleEditState((prev) =>
                      prev
                        ? {
                            ...prev,
                            entry: { ...prev.entry, startTime: e.target.value },
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
                  value={scheduleEditState.entry.endTime}
                  onChange={(e) =>
                    setScheduleEditState((prev) =>
                      prev
                        ? {
                            ...prev,
                            entry: { ...prev.entry, endTime: e.target.value },
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

      {/* ── Missing Data Dialog ── */}
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
          <div className="mt-3 space-y-3 text-sm overflow-y-auto flex-1 min-h-0">
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
              onClick={() => handleSaveSchedule(true)}
              disabled={isSaving}
              autoClose={false}
            >
              {isSaving ? "Oppretter..." : "Ja, opprett og lagre"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Toast ── */}
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
