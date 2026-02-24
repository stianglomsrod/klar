"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { getSubjectTheme } from "@/utils/subject-colors";
import {
  Plus,
  Edit2,
  Clock,
  Check,
  User,
  RotateCcw,
  Eraser,
  Trash2,
  Copy,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import TimePicker from "@/components/ui/time-picker";

type ScheduleEntry = {
  id: string;
  class_id: string | null;
  student_id: string | null;
  subject_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: string;
  custom_title: string | null;
  week_number?: number | null;
};

type MergedEntry = ScheduleEntry & {
  isOverride?: boolean;
  isFallback?: boolean;
};

type Subject = {
  id: string;
  title: string;
  emoji: string;
  color_theme: string | null;
};

type ClassInfo = {
  name: string | null;
  grade: number | null;
};

type SlotTemplate = {
  start: string;
  end: string;
  type: "lesson" | "break";
  title: string;
};

const DAYS_OF_WEEK = [
  { number: 1, name: "Mandag" },
  { number: 2, name: "Tirsdag" },
  { number: 3, name: "Onsdag" },
  { number: 4, name: "Torsdag" },
  { number: 5, name: "Fredag" },
];

const SCHEDULE_TYPES = ["lesson", "break", "activity"];

const BASE_SLOTS: SlotTemplate[] = [
  { start: "08:30", end: "09:15", type: "lesson", title: "1. time" },
  { start: "09:15", end: "10:00", type: "lesson", title: "2. time" },
  { start: "10:00", end: "10:10", type: "break", title: "Friminutt" },
  { start: "10:10", end: "10:55", type: "lesson", title: "3. time" },
  { start: "10:55", end: "11:15", type: "break", title: "Lunsj" },
  { start: "11:15", end: "11:45", type: "break", title: "Friminutt" },
  { start: "11:45", end: "12:30", type: "lesson", title: "4. time" },
  { start: "12:30", end: "12:40", type: "break", title: "Friminutt" },
  { start: "12:40", end: "13:25", type: "lesson", title: "5. time" },
];

const EXTRA_SLOT_6TH: SlotTemplate = {
  start: "13:25",
  end: "14:10",
  type: "lesson",
  title: "6. time",
};

const shouldIncludeSixth = (grade: number | null, day: number) => {
  if (!grade) return false;
  return grade >= 5 && grade <= 7 && day >= 1 && day <= 3;
};

const parseGradeFromClassName = (name: string | null): number | null => {
  if (!name) return null;
  const match = name.match(/\d+/);
  if (!match) return null;
  const grade = parseInt(match[0], 10);
  return Number.isNaN(grade) ? null : grade;
};

type WeeklyScheduleEditorProps = {
  classId: string;
  studentId?: string;
  studentName?: string;
  mode?: "master" | "weekly";
  externalWeekNumber?: number;
  onWeekNumberChange?: (week: number) => void;
  hideWeekSelector?: boolean;
  highlightOverrides?: boolean;
};

export default function WeeklyScheduleEditor({
  classId,
  studentId,
  studentName,
  mode = "weekly",
  externalWeekNumber,
  onWeekNumberChange,
  hideWeekSelector = false,
  highlightOverrides = false,
}: WeeklyScheduleEditorProps) {
  const [scheduleEntries, setScheduleEntries] = useState<MergedEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo>({
    name: null,
    grade: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [alsoSaveAsMasterplan, setAlsoSaveAsMasterplan] = useState(false);
  const [isMakingMasterplan, setIsMakingMasterplan] = useState(false);

  const getISOWeekNumber = (date: Date): number => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(
    () => externalWeekNumber ?? getISOWeekNumber(new Date()),
  );

  const [formData, setFormData] = useState({
    subject_id: "",
    selected_days: [1] as number[],
    start_time: "09:00",
    end_time: "10:00",
    type: "lesson",
    custom_title: "",
    target: studentId ? "student" : "class",
  });

  const supabase = createClient();

  useEffect(() => {
    if (
      typeof externalWeekNumber === "number" &&
      externalWeekNumber !== selectedWeekNumber
    ) {
      setSelectedWeekNumber(externalWeekNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalWeekNumber]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, studentId, selectedWeekNumber]);

  const handleWeekNumberChange = (week: number) => {
    const clamped = hideWeekSelector
      ? Math.max(0, Math.min(53, week))
      : Math.max(1, Math.min(53, week));
    setSelectedWeekNumber(clamped);
    onWeekNumberChange?.(clamped);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const subjectsPromise = supabase
        .from("subjects")
        .select("id, title, emoji, color_theme")
        .order("title");

      const classPromise = supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .single();

      const fetchWithFallback = async (
        target: { classId: string; studentId?: string | null },
        week: number,
      ) => {
        const base = () =>
          supabase
            .from("schedule_entries")
            .select("*")
            .eq("class_id", target.classId)
            .order("day_of_week")
            .order("start_time");

        const mergeKey = (entry: ScheduleEntry) =>
          `${entry.day_of_week}-${entry.start_time}-${entry.end_time}-${
            target.studentId || "class"
          }`;

        const scoped = (
          query: ReturnType<typeof base>,
          studentId?: string | null,
        ) =>
          studentId
            ? query.eq("student_id", studentId)
            : query.is("student_id", null);

        const { data: primaryData, error: primaryError } = await scoped(
          base().eq("week_number", week),
          target.studentId,
        );
        if (primaryError) throw primaryError;

        const fallbackData =
          week === 0
            ? []
            : (await scoped(base().eq("week_number", 0), target.studentId))
                .data || [];

        const merged = new Map<string, MergedEntry>();

        (fallbackData || []).forEach((entry) => {
          merged.set(mergeKey(entry), { ...entry, isFallback: true });
        });

        (primaryData || []).forEach((entry) => {
          merged.set(mergeKey(entry), { ...entry, isFallback: false });
        });

        return Array.from(merged.values());
      };

      const [
        { data: subjectsData, error: subjectsError },
        { data: classData, error: classError },
      ] = await Promise.all([subjectsPromise, classPromise]);

      const classEntries = await fetchWithFallback(
        { classId },
        selectedWeekNumber,
      );
      const studentEntries = studentId
        ? await fetchWithFallback({ classId, studentId }, selectedWeekNumber)
        : [];

      if (subjectsError) throw subjectsError;
      if (classError) throw classError;

      setSubjects(subjectsData || []);

      const mergeKey = (entry: ScheduleEntry) =>
        `${entry.day_of_week}-${entry.start_time}-${entry.end_time}`;

      const map = new Map<string, MergedEntry>();
      (classEntries || []).forEach((e) => {
        const key = mergeKey(e);
        map.set(key, { ...e, isOverride: false });
      });

      if (studentId) {
        (studentEntries || []).forEach((e) => {
          const key = mergeKey(e);
          map.set(key, { ...e, isOverride: true });
        });
      }

      setScheduleEntries(Array.from(map.values()));

      if (classData) {
        const grade = parseGradeFromClassName(classData.name);
        setClassInfo({ name: classData.name, grade });
      }
    } catch (error) {
      console.error("Error fetching schedule data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entry?: ScheduleEntry) => {
    if (entry) {
      setEditingEntry(entry);
      // Only show custom_title in the form if it differs from the computed default label
      const defaultLabel = getDefaultTitle(entry);
      const actualCustomTitle =
        entry.custom_title && entry.custom_title !== defaultLabel
          ? entry.custom_title
          : "";
      setFormData({
        subject_id: entry.subject_id || "",
        selected_days: [entry.day_of_week],
        start_time: entry.start_time,
        end_time: entry.end_time,
        type: entry.type,
        custom_title: actualCustomTitle,
        target: entry.student_id ? "student" : studentId ? "student" : "class",
      });
    } else {
      setEditingEntry(null);
      setFormData({
        subject_id: "",
        selected_days: [1, 2, 3, 4, 5],
        start_time: "09:00",
        end_time: "10:00",
        type: "lesson",
        custom_title: "",
        target: studentId ? "student" : "class",
      });
    }
    setIsModalOpen(true);
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => {
      const days = prev.selected_days.includes(day)
        ? prev.selected_days.filter((d) => d !== day)
        : [...prev.selected_days, day].sort((a, b) => a - b);
      return { ...prev, selected_days: days };
    });
  };

  const handleSave = async () => {
    if (!formData.subject_id && !formData.custom_title) {
      alert("Velg fag eller skriv en tittel");
      return;
    }

    if (formData.start_time >= formData.end_time) {
      alert("Starttiden må være før sluttiden");
      return;
    }

    if (formData.selected_days.length === 0) {
      alert("Velg minst én dag");
      return;
    }

    try {
      const desiredStudentId = formData.target === "student" ? studentId : null;
      const targetWeek = selectedWeekNumber;

      if (editingEntry) {
        // Edit mode — single entry, use first selected day
        const entryData = {
          subject_id: formData.subject_id || null,
          day_of_week: formData.selected_days[0],
          start_time: formData.start_time,
          end_time: formData.end_time,
          type: formData.type,
          custom_title: formData.custom_title || null,
          class_id: classId,
          student_id: desiredStudentId,
          week_number: targetWeek,
        };

        const editingIsClassSlot = !editingEntry.student_id;
        const targetIsStudent = !!desiredStudentId;
        const isSameWeek =
          (editingEntry.week_number ?? 0) === (targetWeek ?? 0);
        const editingCameFromFallback = (editingEntry as MergedEntry)
          .isFallback;

        const shouldInsertNew = !isSameWeek || editingCameFromFallback;

        if (editingIsClassSlot && targetIsStudent) {
          const { error } = await supabase
            .from("schedule_entries")
            .insert(entryData);
          if (error) throw error;
        } else if (shouldInsertNew) {
          const { error } = await supabase
            .from("schedule_entries")
            .insert(entryData);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("schedule_entries")
            .update(entryData)
            .eq("id", editingEntry.id);
          if (error) throw error;
        }
      } else {
        // Create mode — batch insert across all selected days
        const rows = formData.selected_days.map((day) => ({
          subject_id: formData.subject_id || null,
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          type: formData.type,
          custom_title: formData.custom_title || null,
          class_id: classId,
          student_id: desiredStudentId,
          week_number: targetWeek,
        }));

        const { error } = await supabase.from("schedule_entries").insert(rows);
        if (error) throw error;
      }

      // Duplicate to masterplan (week 0) if toggled and we're NOT already on week 0
      if (alsoSaveAsMasterplan && targetWeek !== 0) {
        if (editingEntry) {
          const masterRow = {
            subject_id: formData.subject_id || null,
            day_of_week: formData.selected_days[0],
            start_time: formData.start_time,
            end_time: formData.end_time,
            type: formData.type,
            custom_title: formData.custom_title || null,
            class_id: classId,
            student_id: desiredStudentId,
            week_number: 0,
          };
          await supabase.from("schedule_entries").insert(masterRow);
        } else {
          const masterRows = formData.selected_days.map((day) => ({
            subject_id: formData.subject_id || null,
            day_of_week: day,
            start_time: formData.start_time,
            end_time: formData.end_time,
            type: formData.type,
            custom_title: formData.custom_title || null,
            class_id: classId,
            student_id: desiredStudentId,
            week_number: 0,
          }));
          await supabase.from("schedule_entries").insert(masterRows);
        }
      }

      await fetchData();
      setIsModalOpen(false);
      setAlsoSaveAsMasterplan(false);
    } catch (error) {
      console.error("Error saving schedule entry:", error);
      alert("Kunne ikke lagre timeplanen. Prøv igjen.");
    }
  };

  const handleClearSlot = async (entry: MergedEntry) => {
    try {
      const { error } = await supabase
        .from("schedule_entries")
        .update({
          subject_id: null,
          custom_title: null,
        })
        .eq("id", entry.id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error clearing schedule entry:", error);
      alert("Kunne ikke tømme denne timen. Prøv igjen.");
    }
  };

  const handleResetOverride = async (entry: MergedEntry) => {
    if (entry.isFallback || selectedWeekNumber === 0) return;

    try {
      const { error } = await supabase
        .from("schedule_entries")
        .delete()
        .eq("id", entry.id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error resetting override:", error);
      alert("Kunne ikke tilbakestille denne timen.");
    }
  };

  const handleDeleteEntry = async (entry: MergedEntry) => {
    try {
      const { error } = await supabase
        .from("schedule_entries")
        .delete()
        .eq("id", entry.id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error deleting schedule entry:", error);
      alert("Kunne ikke slette denne timen. Prøv igjen.");
    }
  };

  const getDefaultTitle = (entry: ScheduleEntry) => {
    const start = entry.start_time?.slice(0, 5) || "";
    switch (start) {
      case "08:30":
        return "1. time";
      case "09:15":
        return "2. time";
      case "10:00":
        return "Friminutt";
      case "10:10":
        return "3. time";
      case "10:55":
        return "Lunsj";
      case "11:15":
        return "Friminutt";
      case "11:45":
        return "4. time";
      case "12:30":
        return "Friminutt";
      case "12:40":
        return "5. time";
      case "13:25":
        return "6. time";
      default:
        return "";
    }
  };

  const getSubjectMeta = (subjectId: string | null) => {
    if (!subjectId) return null;
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return null;
    const theme = getSubjectTheme(subject.color_theme || "blue");
    return {
      name: subject.title,
      theme,
    };
  };

  const getEntriesForDay = (dayNumber: number) => {
    const hideSixth = classInfo.grade !== null && classInfo.grade < 5;
    return scheduleEntries
      .filter((e) => e.day_of_week === dayNumber)
      .filter((e) => {
        if (!hideSixth) return true;
        const isSixthPeriodStart = e.start_time?.startsWith("13:25");
        const isSixthPeriodEnd = e.end_time?.startsWith("14:10");
        return !(isSixthPeriodStart && isSixthPeriodEnd);
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const handleMakeMasterplan = async () => {
    if (selectedWeekNumber === 0 || isMakingMasterplan) return;
    setIsMakingMasterplan(true);
    try {
      // 1. Delete existing week 0 entries for this class (class-level only)
      const deleteQuery = supabase
        .from("schedule_entries")
        .delete()
        .eq("class_id", classId)
        .eq("week_number", 0)
        .is("student_id", null);
      const { error: delError } = await deleteQuery;
      if (delError) throw delError;

      // 2. Copy current week entries → week 0
      const classEntries = scheduleEntries.filter((e) => !e.student_id);
      if (classEntries.length > 0) {
        const rows = classEntries.map((e) => ({
          class_id: classId,
          student_id: null,
          subject_id: e.subject_id,
          day_of_week: e.day_of_week,
          start_time: e.start_time,
          end_time: e.end_time,
          type: e.type,
          custom_title: e.custom_title,
          week_number: 0,
        }));
        const { error: insError } = await supabase
          .from("schedule_entries")
          .insert(rows);
        if (insError) throw insError;
      }

      await fetchData();
    } catch (error) {
      console.error("Error making masterplan:", error);
      alert("Kunne ikke sette som fast timeplan. Prøv igjen.");
    } finally {
      setIsMakingMasterplan(false);
    }
  };

  const handleGenerateWeek = async () => {
    if (studentId) return;
    if (!classId) return;
    if (scheduleEntries.length > 0) return;

    setIsGenerating(true);
    try {
      const grade = classInfo.grade;
      const days = [1, 2, 3, 4, 5];
      const entriesToInsert = days.flatMap((day) => {
        const base = BASE_SLOTS.map((slot) => ({
          class_id: classId,
          student_id: null,
          subject_id: null,
          day_of_week: day,
          start_time: slot.start,
          end_time: slot.end,
          type: slot.type,
          custom_title: slot.title,
          week_number: selectedWeekNumber,
        }));

        const extra = shouldIncludeSixth(grade, day)
          ? [
              {
                class_id: classId,
                student_id: null,
                subject_id: null,
                day_of_week: day,
                start_time: EXTRA_SLOT_6TH.start,
                end_time: EXTRA_SLOT_6TH.end,
                type: EXTRA_SLOT_6TH.type,
                custom_title: EXTRA_SLOT_6TH.title,
                week_number: selectedWeekNumber,
              },
            ]
          : [];

        return [...base, ...extra];
      });

      const { error } = await supabase
        .from("schedule_entries")
        .insert(entriesToInsert);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error generating weekly schedule:", error);
      alert("Kunne ikke generere ukeplan. Prøv igjen.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-slate-400">Laster timeplan...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {studentId ? "Personlig timeplan" : "Klassens timeplan"}
        </h2>
        <div className="flex items-center gap-3">
          {!hideWeekSelector && (
            <div className="flex items-center gap-2 bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-sm font-semibold">Uke</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleWeekNumberChange(selectedWeekNumber - 1)}
                  className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50"
                  aria-label="Forrige uke"
                >
                  –
                </button>
                <span className="min-w-[36px] text-center font-semibold">
                  {selectedWeekNumber}
                </span>
                <button
                  onClick={() => handleWeekNumberChange(selectedWeekNumber + 1)}
                  className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50"
                  aria-label="Neste uke"
                >
                  +
                </button>
              </div>
            </div>
          )}
          {/* Make masterplan — only shown when viewing a specific week with entries */}
          {selectedWeekNumber > 0 &&
            scheduleEntries.length > 0 &&
            !studentId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm">
                    <Copy size={16} />
                    Sett som fast timeplan
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Sett uke {selectedWeekNumber} som fast timeplan?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Dette vil overskrive klassens nåværende faste timeplan med
                      innholdet fra uke {selectedWeekNumber}. Alle fremtidige
                      uker uten egne endringer vil bruke denne som utgangspunkt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleMakeMasterplan}
                      disabled={isMakingMasterplan}
                    >
                      {isMakingMasterplan ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-1" />
                          Kopierer...
                        </>
                      ) : (
                        "Ja, sett som fast"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            Legg til time
          </button>
        </div>
      </div>

      {!studentId && !loading && scheduleEntries.length === 0 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              Ingen timer enda
            </div>
            <div className="text-sm text-slate-600">
              Generer en full ukeplan med riktige pauser og timer for{" "}
              {classInfo.name || "klassen"}. 6. time legges kun til for 5.-7.
              trinn mandag–onsdag.
            </div>
          </div>
          <button
            onClick={handleGenerateWeek}
            disabled={isGenerating}
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? "Genererer..." : "Generer ukeplan"}
          </button>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS_OF_WEEK.map((day) => {
          const dayEntries = getEntriesForDay(day.number);
          return (
            <div
              key={day.number}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm"
            >
              {/* Day Header */}
              <div className="bg-indigo-50 border-b border-slate-200 p-3">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {day.name}
                </h3>
              </div>

              {/* Day Entries */}
              <div className="divide-y divide-slate-200 min-h-[400px] p-2 space-y-2">
                {dayEntries.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2 text-center">
                    Ingen timer
                  </div>
                ) : (
                  dayEntries.map((entry) => {
                    const isPersonal = !!entry.student_id;
                    const isWeekOverride =
                      highlightOverrides &&
                      selectedWeekNumber > 0 &&
                      !entry.isFallback;

                    return (
                      <div
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenModal(entry)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleOpenModal(entry);
                          }
                        }}
                        className={`p-2 rounded text-xs group relative border shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all duration-150 hover:-translate-y-[2px] hover:shadow-md ${
                          isPersonal
                            ? "bg-indigo-50/70 border-indigo-100"
                            : "bg-white border-slate-200 hover:bg-slate-50/80"
                        } ${
                          isWeekOverride
                            ? "border-amber-400 bg-amber-50/60"
                            : ""
                        }`}
                      >
                        {(() => {
                          const subjectMeta = getSubjectMeta(entry.subject_id);
                          const borderColor = subjectMeta
                            ? subjectMeta.theme.border
                            : "border-slate-300";
                          // Prefix: always computed from time slot
                          const prefix =
                            getDefaultTitle(entry) || "Uten tittel";
                          // Suffix: subject name OR actual custom title (not matching default label)
                          const defaultLabel = getDefaultTitle(entry);
                          const actualCustom =
                            entry.custom_title &&
                            entry.custom_title !== defaultLabel
                              ? entry.custom_title
                              : null;
                          const suffix =
                            subjectMeta?.name || actualCustom || null;
                          const topLine = suffix
                            ? `${prefix} · ${suffix}`
                            : prefix;

                          return (
                            <div
                              className={`flex items-start justify-between gap-1 border-l-4 ${borderColor} pl-3 transition-colors duration-150 group-hover:border-l-[6px] group-hover:pl-[11px]`}
                            >
                              {isPersonal && (
                                <div
                                  className="absolute top-1 right-1 text-indigo-500/80"
                                  aria-hidden
                                >
                                  <User size={14} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {isPersonal && (
                                    <span className="inline-block px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-medium">
                                      Personlig
                                    </span>
                                  )}
                                  {isWeekOverride && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                                      Endret
                                    </span>
                                  )}
                                </div>
                                <p className="font-semibold text-slate-900 truncate leading-tight">
                                  {topLine}
                                </p>
                                <p className="text-slate-600 flex items-center gap-1">
                                  <Clock size={12} />
                                  {entry.start_time.slice(0, 5)} -{" "}
                                  {entry.end_time.slice(0, 5)}
                                </p>
                              </div>
                              <div
                                className="hidden group-hover:flex gap-1 flex-shrink-0 items-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isWeekOverride && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResetOverride(entry);
                                    }}
                                    className="p-1 text-amber-800 hover:bg-amber-100 rounded transition-colors flex items-center gap-1"
                                    title="Tilbakestill til master"
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenModal(entry)}
                                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                                  title="Rediger"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleClearSlot(entry)}
                                  className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors"
                                  title="Tøm innhold"
                                >
                                  <Eraser size={14} />
                                </button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button
                                      className="p-1 text-slate-600 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                                      title="Slett time"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Slett time?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Er du sikker på at du vil fjerne denne
                                        timen fra timeplanen? Dette kan ikke
                                        angres.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Avbryt
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        variant="destructive"
                                        onClick={() => handleDeleteEntry(entry)}
                                      >
                                        Slett
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {editingEntry ? "Rediger time" : "Legg til time"}
                {selectedWeekNumber === 0
                  ? " (Fast Timeplan)"
                  : ` (Uke ${selectedWeekNumber})`}
              </h3>

              {/* Target Selector (if studentId is available) */}
              {studentId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    For hvem:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value="class"
                        checked={formData.target === "class"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            target: e.target.value,
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">
                        Hele klassen
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value="student"
                        checked={formData.target === "student"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            target: e.target.value,
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">
                        Kun {studentName || "denne eleven"}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Subject Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Fag (valgfritt hvis tittel er satt):
                </label>
                <select
                  value={formData.subject_id}
                  onChange={(e) =>
                    setFormData({ ...formData, subject_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Velg fag</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.emoji} {subject.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Eller skriv tittel:
                </label>
                <input
                  type="text"
                  value={formData.custom_title}
                  onChange={(e) =>
                    setFormData({ ...formData, custom_title: e.target.value })
                  }
                  placeholder="f.eks. Logoped"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Day Selection — multi-select toggle buttons */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {editingEntry ? "Dag:" : "Dager:"}
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = formData.selected_days.includes(
                      day.number,
                    );
                    return (
                      <button
                        key={day.number}
                        type="button"
                        onClick={() => {
                          if (editingEntry) {
                            // In edit mode, single-select only
                            setFormData({
                              ...formData,
                              selected_days: [day.number],
                            });
                          } else {
                            toggleDay(day.number);
                          }
                        }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {day.name.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
                {!editingEntry && (
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          selected_days: [1, 2, 3, 4, 5],
                        })
                      }
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Alle dager
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, selected_days: [] })
                      }
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                    >
                      Ingen
                    </button>
                  </div>
                )}
              </div>

              {/* Time Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    Start:
                  </label>
                  <TimePicker
                    value={formData.start_time}
                    onChange={(val) =>
                      setFormData({ ...formData, start_time: val })
                    }
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    Slutt:
                  </label>
                  <TimePicker
                    value={formData.end_time}
                    onChange={(val) =>
                      setFormData({ ...formData, end_time: val })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {/* Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Type:
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SCHEDULE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "lesson"
                        ? "Time"
                        : type === "break"
                          ? "Pause"
                          : "Aktivitet"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Masterplan toggle — only when saving to a specific week (not week 0) */}
              {selectedWeekNumber > 0 && (
                <label className="flex items-center gap-3 pt-1 cursor-pointer">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alsoSaveAsMasterplan}
                    onClick={() =>
                      setAlsoSaveAsMasterplan(!alsoSaveAsMasterplan)
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      alsoSaveAsMasterplan ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        alsoSaveAsMasterplan
                          ? "translate-x-[18px]"
                          : "translate-x-[3px]"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-slate-700">
                    Lagre også som fast timeplan
                  </span>
                </label>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setAlsoSaveAsMasterplan(false);
                  }}
                  className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Lagre
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
