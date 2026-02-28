"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { createClient } from "@/utils/supabase/client";
import { Check } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { getISOWeekNumber } from "@/utils/week-number";
import { WEEKDAYS } from "@/utils/constants";
import { fetchScheduleFallback } from "@/utils/supabase/schedule-queries";
import type { TeacherScheduleEntry } from "@/types/shared";

type ScheduleEntry = TeacherScheduleEntry;

const DAYS = WEEKDAYS;

export interface SchedulePickerRef {
  /** Returns the set of selected schedule entry IDs. */
  getSelectedEntryIds: () => Set<string>;
  /** Returns the full selected schedule entries (for week_number inspection). */
  getSelectedEntries: () => ScheduleEntry[];
  /** Returns the week number currently displayed in the picker. */
  getViewingWeek: () => number;
}

interface SchedulePickerProps {
  /** Single-class ID from recipient eligibility, or null when multi-class / no selection. */
  classId: string | null;
  /** Single student ID when exactly one student is selected, or null. */
  studentId: string | null;
  /** Current subject ID from the task form. */
  subjectId: string;
  /** Current due-date string (yyyy-mm-dd). Used to auto-sync week number. */
  dueDate: string;
  /** Whether the trigger button should be disabled (from parent eligibility logic). */
  disabled: boolean;
  /** Hint text to show next to the label (e.g. "Velg fag for å knytte til time"). */
  hint: string | null;
  /** Called whenever the number of selected entries changes. */
  onSelectionChange?: (count: number) => void;
}

const SchedulePicker = forwardRef<SchedulePickerRef, SchedulePickerProps>(
  function SchedulePicker(
    {
      classId,
      studentId,
      subjectId,
      dueDate,
      disabled,
      hint,
      onSelectionChange,
    },
    ref,
  ) {
    const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
      new Set(),
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [weekNumber, setWeekNumber] = useState<number>(() =>
      getISOWeekNumber(new Date()),
    );

    const supabase = createClient();

    // ----- imperative handle -----

    useImperativeHandle(
      ref,
      () => ({
        getSelectedEntryIds: () => selectedEntryIds,
        getSelectedEntries: () =>
          scheduleEntries.filter((e) => selectedEntryIds.has(e.id)),
        getViewingWeek: () => weekNumber,
      }),
      [selectedEntryIds, scheduleEntries, weekNumber],
    );

    // ----- effects -----

    // Sync week number from due date
    useEffect(() => {
      if (dueDate) {
        const due = new Date(dueDate);
        if (!Number.isNaN(due.getTime())) {
          setWeekNumber(getISOWeekNumber(due));
        }
      }
    }, [dueDate]);

    // Reset when context changes (subject, class, student)
    useEffect(() => {
      setSelectedEntryIds(new Set());
      setScheduleEntries([]);
      setOpen(false);
      setError(null);
    }, [subjectId, classId, studentId]);

    // Notify parent of selection changes
    useEffect(() => {
      onSelectionChange?.(selectedEntryIds.size);
    }, [selectedEntryIds.size, onSelectionChange]);

    // Re-fetch when week changes while open
    useEffect(() => {
      if (open) {
        fetchSchedule();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekNumber]);

    // ----- data fetching -----

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapScheduleRow = (row: any): ScheduleEntry => ({
      id: row.id,
      class_id: row.class_id,
      student_id: row.student_id,
      subject_id: row.subject_id,
      subject_title: row.subjects?.title ?? null,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      custom_title: row.custom_title,
      type: row.type,
      week_number: row.week_number ?? 0,
    });

    const fetchSchedule = async () => {
      if (!classId) return;
      setIsLoading(true);
      setError(null);

      try {
        const classEntries = await fetchScheduleFallback(
          supabase,
          { classId },
          weekNumber,
        );

        const mergedMap = new Map<string, ScheduleEntry>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (classEntries || []).forEach((row: any) => {
          const entry = mapScheduleRow(row);
          const key = `${entry.day_of_week}-${entry.start_time}-${entry.end_time}`;
          mergedMap.set(key, entry);
        });

        if (studentId) {
          const studentEntries = await fetchScheduleFallback(
            supabase,
            { classId, studentId },
            weekNumber,
          );

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (studentEntries || []).forEach((row: any) => {
            const entry = mapScheduleRow(row);
            const key = `${entry.day_of_week}-${entry.start_time}-${entry.end_time}`;
            mergedMap.set(key, { ...entry, isOverride: true });
          });
        }

        setScheduleEntries(Array.from(mergedMap.values()));
        setOpen(true);
      } catch {
        setError("Kunne ikke laste timeplanen");
      } finally {
        setIsLoading(false);
      }
    };

    // ----- handlers -----

    const toggleEntry = (entryId: string) => {
      setSelectedEntryIds((prev) => {
        const next = new Set(prev);
        if (next.has(entryId)) {
          next.delete(entryId);
        } else {
          next.add(entryId);
        }
        return next;
      });
    };

    // ----- computed -----

    const selectedBadges = scheduleEntries
      .filter((e) => selectedEntryIds.has(e.id))
      .map((e) => {
        const day = DAYS.find((d) => d.number === e.day_of_week)?.label || "";
        const time = e.start_time?.slice(0, 5) ?? "";
        const subject = e.subject_title ?? e.custom_title ?? "";
        return `${day} ${time} ${subject}`.trim();
      });

    const buttonDisabled = disabled || isLoading;

    // ----- render -----

    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-700">Tidsstyring</p>
            {hint && (
              <p className="text-xs text-slate-500 mt-1 max-w-xs">{hint}</p>
            )}
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={buttonDisabled}
                onClick={fetchSchedule}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  buttonDisabled
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                }`}
              >
                Knytt til time(r)
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-4" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Velg timer
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedEntryIds.size} valgt
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                      onClick={() =>
                        setWeekNumber((prev) => Math.max(0, prev - 1))
                      }
                      aria-label="Forrige uke"
                    >
                      –
                    </button>
                    <div className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                      Uke {weekNumber}
                    </div>
                    <button
                      type="button"
                      className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                      onClick={() =>
                        setWeekNumber((prev) => Math.min(53, prev + 1))
                      }
                      aria-label="Neste uke"
                    >
                      +
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </p>
                )}

                {isLoading && !error && (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-slate-500">Laster timeplan...</p>
                  </div>
                )}

                {!isLoading && !error && scheduleEntries.length === 0 && (
                  <p className="text-sm text-slate-500 py-4">
                    Ingen timer funnet for denne klassen.
                  </p>
                )}

                {!isLoading && !error && scheduleEntries.length > 0 && (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {DAYS.map((day) => {
                      const entriesForDay = scheduleEntries
                        .filter((e) => e.day_of_week === day.number)
                        .sort((a, b) =>
                          a.start_time.localeCompare(b.start_time),
                        );

                      if (entriesForDay.length === 0) return null;

                      return (
                        <div key={day.number} className="space-y-2">
                          <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            {day.label}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {entriesForDay.map((entry) => {
                              const isSelected = selectedEntryIds.has(entry.id);
                              const subjectMatches =
                                entry.subject_id === subjectId && subjectId;
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => toggleEntry(entry.id)}
                                  className={`relative text-left rounded-md px-2.5 py-2 text-xs font-medium transition-all ${
                                    isSelected
                                      ? "bg-indigo-600 text-white border-2 border-indigo-700 shadow-md"
                                      : subjectMatches
                                        ? "bg-slate-50 text-slate-900 border-2 border-green-300 hover:bg-green-50"
                                        : "bg-slate-50 text-slate-700 border-2 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="font-semibold leading-tight">
                                        {entry.start_time}
                                      </p>
                                      {entry.subject_title && (
                                        <p className="text-xs opacity-75">
                                          {entry.subject_title}
                                        </p>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <Check className="h-4 w-4 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {selectedBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedBadges.map((badge, idx) => (
              <span
                key={`${badge}-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
              >
                <Check className="h-3 w-3" />
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default SchedulePicker;
