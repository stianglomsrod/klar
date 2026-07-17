"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { getISOWeekNumber, getISODayOfWeek } from "@/utils/week-number";

type ScheduleEntry = {
  id: string;
  subject_id: string | null;
  start_time: string;
  end_time: string;
  type: string;
  custom_title: string | null;
  subject_title?: string;
  emoji?: string;
};

type ActivityType = "lesson" | "break" | "free" | "upcoming";

type CurrentActivity = {
  title: string;
  emoji: string;
  type: ActivityType;
  endTime: string | null;
  startTime: string | null;
};

type TimeTrackerResult = {
  currentActivity: CurrentActivity;
  timeRemaining: string;
  progress: number; // 0-100
  loading: boolean;
};

/**
 * Hook to track the current schedule activity based on real-time.
 *
 * Uses the `get_student_schedule` RPC for consistent deduplication
 * (DISTINCT ON prefers week-specific entries over masterplan).
 * Falls back to raw `schedule_entries` query when no studentId is available.
 *
 * @param studentId - The student's ID (used for RPC call)
 * @param classId   - The student's class ID (fallback only)
 */
export function useTimeTracker(
  studentId: string | undefined,
  classId: string | undefined,
): TimeTrackerResult {
  const [currentActivity, setCurrentActivity] = useState<CurrentActivity>({
    title: "Laster...",
    emoji: "⏳",
    type: "free",
    endTime: null,
    startTime: null,
  });
  const [timeRemaining, setTimeRemaining] = useState<string>("--");
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [refetchTick, setRefetchTick] = useState(0);

  // M1 fix: memoize the Supabase client so we don't create one per render
  const supabase = useMemo(() => createClient(), []);

  // Keep a stable ref for IDs to avoid stale closures in the interval
  const studentIdRef = useRef(studentId);
  const classIdRef = useRef(classId);
  useEffect(() => {
    studentIdRef.current = studentId;
    classIdRef.current = classId;
  }, [studentId, classId]);

  // Periodic schedule refetch every 5 minutes
  useEffect(() => {
    const interval = setInterval(
      () => setRefetchTick((t) => t + 1),
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  // Fetch schedule data — uses RPC for consistent deduplication
  useEffect(() => {
    if (!studentId && !classId) return;

    const fetchSchedule = async () => {
      try {
        const now = new Date();
        const dayOfWeek = getISODayOfWeek(now);
        const weekNumber = getISOWeekNumber(now);

        if (studentId) {
          // ── Primary path: use get_student_schedule RPC ──
          // This gives us dedup'd entries with subject data already joined
          const { data: rpcData } = await supabase.rpc("get_student_schedule", {
            p_student_id: studentId,
            p_current_week_number: weekNumber,
          });

          if (rpcData && rpcData.length > 0) {
            // Filter to today only and map to our ScheduleEntry shape
            const todayEntries: ScheduleEntry[] = rpcData
              .filter(
                (e: { day_of_week: number }) => e.day_of_week === dayOfWeek,
              )
              .map(
                (e: {
                  id: string;
                  subject_id: string | null;
                  start_time: string;
                  end_time: string;
                  custom_title: string | null;
                  subject_title: string;
                  emoji: string;
                }) => ({
                  id: e.id,
                  subject_id: e.subject_id,
                  start_time: e.start_time,
                  end_time: e.end_time,
                  type: "lesson" as const, // RPC only returns lessons
                  custom_title: e.custom_title,
                  subject_title: e.subject_title,
                  emoji: e.emoji,
                }),
              );
            setScheduleEntries(todayEntries);
          } else {
            setScheduleEntries([]);
          }
        } else if (classId) {
          // ── Fallback path: raw query (teacher/class mode without studentId) ──
          const buildQuery = (weekNum: number) =>
            supabase
              .from("schedule_entries")
              .select("*, subjects(title, emoji)")
              .eq("day_of_week", dayOfWeek)
              .eq("week_number", weekNum)
              .eq("class_id", classId)
              .is("student_id", null)
              .order("start_time");

          const { data: weekEntries } = await buildQuery(weekNumber);

          if (weekEntries && weekEntries.length > 0) {
            setScheduleEntries(
              weekEntries.map((e: Record<string, unknown>) => ({
                ...e,
                subject_title: (e.subjects as { title?: string })?.title,
                emoji: (e.subjects as { emoji?: string })?.emoji,
              })) as ScheduleEntry[],
            );
          } else {
            const { data: masterEntries } = await buildQuery(0);
            setScheduleEntries(
              (masterEntries || []).map((e: Record<string, unknown>) => ({
                ...e,
                subject_title: (e.subjects as { title?: string })?.title,
                emoji: (e.subjects as { emoji?: string })?.emoji,
              })) as ScheduleEntry[],
            );
          }
        }
      } catch {
        // Silent — schedule fetch failure is non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, studentId, refetchTick, supabase]);

  // Update current activity every 30 seconds
  useEffect(() => {
    if (scheduleEntries.length === 0) {
      setCurrentActivity({
        title: "Ingen timeplan",
        emoji: "📅",
        type: "free",
        endTime: null,
        startTime: null,
      });
      setTimeRemaining("--");
      setProgress(0);
      return;
    }

    const updateActivity = () => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

      // Convert time strings (HH:MM:SS or HH:MM) to minutes
      const parseTime = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
      };

      // Find current or next activity
      let foundActivity: CurrentActivity | null = null;
      let foundProgress = 0;
      let foundTimeRemaining = "--";

      for (let i = 0; i < scheduleEntries.length; i++) {
        const entry = scheduleEntries[i];
        const startMinutes = parseTime(entry.start_time);
        const endMinutes = parseTime(entry.end_time);

        // Check if we're currently in this time slot
        if (currentTime >= startMinutes && currentTime < endMinutes) {
          const totalDuration = endMinutes - startMinutes;
          const elapsed = currentTime - startMinutes;
          const remaining = endMinutes - currentTime;

          foundProgress = (elapsed / totalDuration) * 100;
          foundTimeRemaining = formatTimeRemaining(remaining);

          if (entry.type === "lesson") {
            foundActivity = {
              title: entry.custom_title || entry.subject_title || "Time",
              emoji: entry.emoji || "📚",
              type: "lesson",
              endTime: entry.end_time,
              startTime: entry.start_time,
            };
          } else if (entry.type === "break") {
            foundActivity = {
              title: entry.custom_title || "Pause",
              emoji: "☕",
              type: "break",
              endTime: entry.end_time,
              startTime: entry.start_time,
            };
          } else {
            foundActivity = {
              title: entry.custom_title || "Aktivitet",
              emoji: "🎯",
              type: "break",
              endTime: entry.end_time,
              startTime: entry.start_time,
            };
          }
          break;
        }

        // Check if this is an upcoming activity
        if (currentTime < startMinutes) {
          const minutesUntil = startMinutes - currentTime;
          foundTimeRemaining = formatTimeRemaining(minutesUntil);

          foundActivity = {
            title: entry.custom_title || entry.subject_title || "Neste time",
            emoji: entry.emoji || "📚",
            type: "upcoming",
            endTime: entry.end_time,
            startTime: entry.start_time,
          };
          foundProgress = 0;
          break;
        }

        // Check for break between lessons (implicit Friminutt)
        if (i < scheduleEntries.length - 1) {
          const nextEntry = scheduleEntries[i + 1];
          const nextStartMinutes = parseTime(nextEntry.start_time);

          if (currentTime >= endMinutes && currentTime < nextStartMinutes) {
            const remaining = nextStartMinutes - currentTime;
            const totalBreak = nextStartMinutes - endMinutes;
            const elapsed = currentTime - endMinutes;

            foundProgress = (elapsed / totalBreak) * 100;
            foundTimeRemaining = formatTimeRemaining(remaining);

            foundActivity = {
              title: "Friminutt",
              emoji: "☕",
              type: "break",
              endTime: nextEntry.start_time,
              startTime: entry.end_time,
            };
            break;
          }
        }
      }

      // If no activity found, check if school is over
      if (!foundActivity) {
        const lastEntry = scheduleEntries[scheduleEntries.length - 1];
        const lastEndMinutes = parseTime(lastEntry.end_time);

        if (currentTime >= lastEndMinutes) {
          foundActivity = {
            title: "Skolefri",
            emoji: "🏠",
            type: "free",
            endTime: null,
            startTime: null,
          };
          foundProgress = 100;
          foundTimeRemaining = "Ferdig!";
        } else {
          // Before first lesson
          const firstEntry = scheduleEntries[0];
          const firstStartMinutes = parseTime(firstEntry.start_time);
          const minutesUntil = firstStartMinutes - currentTime;

          foundActivity = {
            title: "Skolestart",
            emoji: "🎒",
            type: "upcoming",
            endTime: null,
            startTime: firstEntry.start_time,
          };
          foundProgress = 0;
          foundTimeRemaining = formatTimeRemaining(minutesUntil);
        }
      }

      setCurrentActivity(foundActivity);
      setProgress(Math.max(0, Math.min(100, foundProgress)));
      setTimeRemaining(foundTimeRemaining);
    };

    // Initial update
    updateActivity();

    // Update every 30 seconds
    const interval = setInterval(updateActivity, 30000);

    return () => clearInterval(interval);
  }, [scheduleEntries]);

  return {
    currentActivity,
    timeRemaining,
    progress,
    loading,
  };
}

/**
 * Format minutes remaining into human-readable string
 */
function formatTimeRemaining(minutes: number): string {
  if (minutes < 0) return "Ferdig";
  if (minutes === 0) return "Nå";
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return `${hours} t`;
  }
  return `${hours} t ${mins} min`;
}
