"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getISOWeekNumber, getISODayOfWeek } from "@/utils/week-number";

type ScheduleEntry = {
  id: string;
  subject_id: string | null;
  start_time: string;
  end_time: string;
  type: string;
  custom_title: string | null;
};

type Subject = {
  id: string;
  title: string;
  emoji: string;
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
 * Hook to track the current schedule activity based on real-time
 * @param studentId - The student's ID
 * @param classId - The student's class ID
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
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const supabase = createClient();

  // Fetch schedule data
  useEffect(() => {
    if (!classId) return;

    const fetchSchedule = async () => {
      try {
        // Fetch subjects
        const { data: subjectsData } = await supabase
          .from("subjects")
          .select("id, title, emoji");

        if (subjectsData) {
          setSubjects(subjectsData);
        }

        // Fetch schedule entries for today (current week, fallback to masterplan)
        const now = new Date();
        const dayOfWeek = getISODayOfWeek(now);
        const weekNumber = getISOWeekNumber(now);

        const buildQuery = (weekNum: number) => {
          let q = supabase
            .from("schedule_entries")
            .select("*")
            .eq("day_of_week", dayOfWeek)
            .eq("week_number", weekNum);

          if (studentId) {
            // Student mode: get class entries + personal entries
            q = q.or(
              `and(class_id.eq.${classId},student_id.is.null),student_id.eq.${studentId}`,
            );
          } else {
            // Class mode only
            q = q.eq("class_id", classId).is("student_id", null);
          }

          return q.order("start_time");
        };

        // Try current week first
        const { data: weekEntries } = await buildQuery(weekNumber);

        if (weekEntries && weekEntries.length > 0) {
          setScheduleEntries(weekEntries);
        } else {
          // Fallback to masterplan (week_number = 0)
          const { data: masterEntries } = await buildQuery(0);
          setScheduleEntries(masterEntries || []);
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [classId, studentId, supabase]);

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
          const subject = subjects.find((s) => s.id === entry.subject_id);
          const totalDuration = endMinutes - startMinutes;
          const elapsed = currentTime - startMinutes;
          const remaining = endMinutes - currentTime;

          foundProgress = (elapsed / totalDuration) * 100;
          foundTimeRemaining = formatTimeRemaining(remaining);

          if (entry.type === "lesson") {
            foundActivity = {
              title: entry.custom_title || subject?.title || "Time",
              emoji: subject?.emoji || "📚",
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
          const subject = subjects.find((s) => s.id === entry.subject_id);
          const minutesUntil = startMinutes - currentTime;
          foundTimeRemaining = formatTimeRemaining(minutesUntil);

          foundActivity = {
            title: entry.custom_title || subject?.title || "Neste time",
            emoji: subject?.emoji || "📚",
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
  }, [scheduleEntries, subjects]);

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
