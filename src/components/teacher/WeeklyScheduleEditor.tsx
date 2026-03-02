"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { getISOWeekNumber } from "@/utils/week-number";
import { useToast } from "@/hooks/useToast";
import { fetchMergedSchedule } from "@/utils/supabase/schedule-queries";
import type {
  ScheduleEntry,
  MergedEntry,
  Subject,
  ClassInfo,
  ScheduleFormData,
} from "./schedule-editor/types";
import {
  DAYS_OF_WEEK,
  parseGradeFromClassName,
} from "./schedule-editor/types";
import {
  getDefaultTitle,
  getEntriesForDay,
} from "./schedule-editor/schedule-helpers";
import ScheduleHeader from "./schedule-editor/ScheduleHeader";
import ScheduleEntryCard from "./schedule-editor/ScheduleEntryCard";
import ScheduleEntryModal from "./schedule-editor/ScheduleEntryModal";

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
  const { toast, showToast, hideToast } = useToast();
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo>({
    name: null,
    grade: null,
  });
  const [alsoSaveAsMasterplan, setAlsoSaveAsMasterplan] = useState(false);
  const [isMakingMasterplan, setIsMakingMasterplan] = useState(false);

  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(
    () => externalWeekNumber ?? getISOWeekNumber(new Date()),
  );

  const [formData, setFormData] = useState<ScheduleFormData>({
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

      const [
        { data: subjectsData, error: subjectsError },
        { data: classData, error: classError },
      ] = await Promise.all([subjectsPromise, classPromise]);

      const classEntries = await fetchMergedSchedule(
        supabase,
        { classId },
        selectedWeekNumber,
      );
      const studentEntries = studentId
        ? await fetchMergedSchedule(
            supabase,
            { classId, studentId },
            selectedWeekNumber,
          )
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
    } catch {
      // Silent – UI shows empty state
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entry?: ScheduleEntry, preselectedDay?: number) => {
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
        selected_days: preselectedDay ? [preselectedDay] : [],
        start_time: "09:00",
        end_time: "10:00",
        type: "lesson",
        custom_title: "",
        target: studentId ? "student" : "class",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.subject_id && !formData.custom_title) {
      showToast("Velg fag eller skriv en tittel", "warning");
      return;
    }

    // Data integrity: strip custom_title when a subject is selected
    const sanitizedCustomTitle = formData.subject_id
      ? ""
      : formData.custom_title;

    if (formData.start_time >= formData.end_time) {
      showToast("Starttiden må være før sluttiden", "warning");
      return;
    }

    if (formData.selected_days.length === 0) {
      showToast("Velg minst én dag", "warning");
      return;
    }

    try {
      const desiredStudentId = formData.target === "student" ? studentId : null;
      const targetWeek = selectedWeekNumber;

      if (editingEntry) {
        // Edit mode — supports multi-day selection
        const editingIsClassSlot = !editingEntry.student_id;
        const targetIsStudent = !!desiredStudentId;
        const isSameWeek =
          (editingEntry.week_number ?? 0) === (targetWeek ?? 0);
        const editingCameFromFallback = (editingEntry as MergedEntry)
          .isFallback;
        const switchingTarget = editingIsClassSlot && targetIsStudent;
        const isMultiDay = formData.selected_days.length > 1;
        const dayChanged =
          !isMultiDay && formData.selected_days[0] !== editingEntry.day_of_week;

        // Build rows for all selected days
        const rows = formData.selected_days.map((day) => ({
          subject_id: formData.subject_id || null,
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          type: formData.type,
          custom_title: sanitizedCustomTitle || null,
          class_id: classId,
          student_id: desiredStudentId,
          week_number: targetWeek,
        }));

        if (switchingTarget || isMultiDay || dayChanged) {
          // Delete the original entry only if we own it and aren't switching target
          if (!switchingTarget && !editingCameFromFallback && isSameWeek) {
            const { error: delError } = await supabase
              .from("schedule_entries")
              .delete()
              .eq("id", editingEntry.id);
            if (delError) throw delError;
          }

          const { error } = await supabase
            .from("schedule_entries")
            .insert(rows);
          if (error) throw error;
        } else {
          // Single day, same day, same target type
          const shouldInsertNew = !isSameWeek || editingCameFromFallback;
          if (shouldInsertNew) {
            const { error } = await supabase
              .from("schedule_entries")
              .insert(rows[0]);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("schedule_entries")
              .update(rows[0])
              .eq("id", editingEntry.id);
            if (error) throw error;
          }
        }
      } else {
        // Create mode — batch insert across all selected days
        const rows = formData.selected_days.map((day) => ({
          subject_id: formData.subject_id || null,
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          type: formData.type,
          custom_title: sanitizedCustomTitle || null,
          class_id: classId,
          student_id: desiredStudentId,
          week_number: targetWeek,
        }));

        const { error } = await supabase.from("schedule_entries").insert(rows);
        if (error) throw error;
      }

      // Duplicate to masterplan (week 0) if toggled and we're NOT already on week 0
      if (alsoSaveAsMasterplan && targetWeek !== 0) {
        const masterRows = formData.selected_days.map((day) => ({
          subject_id: formData.subject_id || null,
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          type: formData.type,
          custom_title: sanitizedCustomTitle || null,
          class_id: classId,
          student_id: desiredStudentId,
          week_number: 0,
        }));

        // 1. Delete existing masterplan entries for these slots (deduplication)
        if (desiredStudentId) {
          await supabase
            .from("schedule_entries")
            .delete()
            .eq("class_id", classId)
            .eq("week_number", 0)
            .in("day_of_week", formData.selected_days)
            .eq("start_time", formData.start_time)
            .eq("end_time", formData.end_time)
            .eq("student_id", desiredStudentId);
        } else {
          await supabase
            .from("schedule_entries")
            .delete()
            .eq("class_id", classId)
            .eq("week_number", 0)
            .in("day_of_week", formData.selected_days)
            .eq("start_time", formData.start_time)
            .eq("end_time", formData.end_time)
            .is("student_id", null);
        }

        // 2. Insert new masterplan entries
        const { error: masterError } = await supabase
          .from("schedule_entries")
          .insert(masterRows);
        if (masterError) throw masterError;

        // 3. Clean up explicit week overrides so the UI falls back to masterplan
        //    (removes the "Endret" badge)
        if (desiredStudentId) {
          await supabase
            .from("schedule_entries")
            .delete()
            .eq("class_id", classId)
            .eq("week_number", targetWeek)
            .in("day_of_week", formData.selected_days)
            .eq("start_time", formData.start_time)
            .eq("end_time", formData.end_time)
            .eq("student_id", desiredStudentId);
        } else {
          await supabase
            .from("schedule_entries")
            .delete()
            .eq("class_id", classId)
            .eq("week_number", targetWeek)
            .in("day_of_week", formData.selected_days)
            .eq("start_time", formData.start_time)
            .eq("end_time", formData.end_time)
            .is("student_id", null);
        }
      }

      await fetchData();
      setIsModalOpen(false);
      setAlsoSaveAsMasterplan(false);
    } catch {
      showToast("Kunne ikke lagre timeplanen. Prøv igjen.", "error");
    }
  };

  const handleClearSlot = async (entry: MergedEntry) => {
    try {
      if (entry.isFallback && selectedWeekNumber > 0) {
        // Don't modify the masterplan row — create a week-specific override with cleared content
        const { error } = await supabase.from("schedule_entries").insert({
          class_id: entry.class_id,
          student_id: entry.student_id,
          subject_id: null,
          day_of_week: entry.day_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
          type: entry.type,
          custom_title: null,
          week_number: selectedWeekNumber,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedule_entries")
          .update({
            subject_id: null,
            custom_title: null,
          })
          .eq("id", entry.id);
        if (error) throw error;
      }
      await fetchData();
    } catch {
      showToast("Kunne ikke tømme denne timen. Prøv igjen.", "error");
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
    } catch {
      showToast("Kunne ikke tilbakestille denne timen.", "error");
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
    } catch {
      showToast("Kunne ikke slette denne timen. Prøv igjen.", "error");
    }
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
    } catch {
      showToast("Kunne ikke sette som fast timeplan. Prøv igjen.", "error");
    } finally {
      setIsMakingMasterplan(false);
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
      <ScheduleHeader
        studentId={studentId}
        selectedWeekNumber={selectedWeekNumber}
        onWeekNumberChange={handleWeekNumberChange}
        hideWeekSelector={hideWeekSelector}
        scheduleEntries={scheduleEntries}
        onAddEntry={() => handleOpenModal()}
        onMakeMasterplan={handleMakeMasterplan}
        isMakingMasterplan={isMakingMasterplan}
      />

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS_OF_WEEK.map((day) => {
          const dayEntries = getEntriesForDay(
            day.number,
            scheduleEntries,
            classInfo,
          );
          return (
            <div
              key={day.number}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm"
            >
              {/* Day Header */}
              <div className="bg-indigo-50 border-b border-slate-200 p-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {day.label}
                </h3>
                <button
                  onClick={() => handleOpenModal(undefined, day.number)}
                  className="p-1 rounded-md text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                  aria-label={`Legg til time på ${day.label}`}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Day Entries */}
              <div className="divide-y divide-slate-200 min-h-[400px] p-2 space-y-2">
                {dayEntries.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2 text-center">
                    Ingen timer
                  </div>
                ) : (
                  dayEntries.map((entry) => (
                    <ScheduleEntryCard
                      key={entry.id}
                      entry={entry}
                      subjects={subjects}
                      highlightOverrides={highlightOverrides}
                      selectedWeekNumber={selectedWeekNumber}
                      onEdit={handleOpenModal}
                      onClear={handleClearSlot}
                      onReset={handleResetOverride}
                      onDelete={handleDeleteEntry}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <ScheduleEntryModal
          formData={formData}
          setFormData={setFormData}
          subjects={subjects}
          isEditing={!!editingEntry}
          selectedWeekNumber={selectedWeekNumber}
          studentId={studentId}
          studentName={studentName}
          alsoSaveAsMasterplan={alsoSaveAsMasterplan}
          setAlsoSaveAsMasterplan={setAlsoSaveAsMasterplan}
          onSave={handleSave}
          onClose={() => {
            setIsModalOpen(false);
            setAlsoSaveAsMasterplan(false);
          }}
        />
      )}
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
