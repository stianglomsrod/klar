"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

// ── Milestone thresholds ────────────────────────────────
const MILESTONE_THRESHOLDS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/** Returns the next milestone value above `last`, or null if all are passed. */
function getNextMilestone(last: number): number | null {
  for (const m of MILESTONE_THRESHOLDS) {
    if (m > last) return m;
  }
  // Beyond 100: every 50 days
  const nextBlock = Math.ceil((last + 1) / 50) * 50;
  return nextBlock > last ? nextBlock : null;
}

/** Format a Date as YYYY-MM-DD in local time. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Check if `dateStr` (YYYY-MM-DD) is yesterday relative to `today`. */
function isYesterday(dateStr: string, today: Date): boolean {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return toLocalDateString(yesterday) === dateStr;
}

// ── Types ────────────────────────────────────────────────

export type AttendanceStreakState = {
  streakEnabled: boolean;
  streakMode: "classic" | "accumulated";
  currentStreak: number;
  longestStreak: number;
  streakStars: number;
  nextMilestoneAt: number | null;
  pendingMilestoneCelebration: boolean;
  milestoneCelebrationStreak: number;
  isNewRecord: boolean;
  dismissMilestone: () => void;
};

// ── Hook ─────────────────────────────────────────────────

export function useAttendanceStreak(): AttendanceStreakState {
  const { profile, refresh } = useStudentProfile();
  const [pendingMilestone, setPendingMilestone] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    if (!profile.streak_enabled) return;
    if (processedRef.current) return;

    const today = toLocalDateString(new Date());
    const lastLogin = profile.last_login_date;

    // Already recorded today — nothing to do
    if (lastLogin === today) return;

    processedRef.current = true;

    const processStreak = async () => {
      const supabase = createClient();
      const now = new Date();

      let newCurrentStreak: number;
      let newLongestStreak = profile.longest_streak;

      if (profile.streak_mode === "accumulated") {
        // Accumulated: always increment, never reset
        newCurrentStreak = profile.current_streak + 1;
        newLongestStreak = newCurrentStreak;
      } else {
        // Classic: consecutive days
        if (lastLogin && isYesterday(lastLogin, now)) {
          // Consecutive — extend streak
          newCurrentStreak = profile.current_streak + 1;
        } else {
          // Streak broken (or first ever login) — start fresh
          newCurrentStreak = 1;
        }
        newLongestStreak = Math.max(profile.longest_streak, newCurrentStreak);
      }

      // Milestone detection
      const lastMilestone = profile.last_streak_milestone;
      const nextMilestone = getNextMilestone(lastMilestone);
      let starsEarned = 0;
      let newLastMilestone = lastMilestone;
      let hitMilestone = false;

      if (nextMilestone !== null && newCurrentStreak >= nextMilestone) {
        // Count how many milestones were crossed (handles multi-day jumps in accumulated mode)
        let check = nextMilestone;
        while (check !== null && newCurrentStreak >= check) {
          starsEarned++;
          newLastMilestone = check;
          const next = getNextMilestone(check);
          if (next !== null && newCurrentStreak >= next) {
            check = next;
          } else {
            break;
          }
        }
        hitMilestone = true;
      }

      // Build update
      const updates: Record<string, unknown> = {
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_login_date: today,
      };

      if (hitMilestone) {
        updates.streak_stars = profile.streak_stars + starsEarned;
        updates.last_streak_milestone = newLastMilestone;
      }

      const { error } = await supabase
        .from("student_profiles")
        .update(updates)
        .eq("id", profile.id);

      if (error) {
        processedRef.current = false;
        return;
      }

      await refresh();

      // Set celebration state after successful persist
      if (hitMilestone) {
        setMilestoneStreak(newCurrentStreak);
        setIsNewRecord(newLongestStreak > profile.longest_streak);
        setPendingMilestone(true);
      }
    };

    processStreak();
  }, [profile, refresh]);

  const dismissMilestone = useCallback(() => {
    setPendingMilestone(false);
  }, []);

  const nextMilestoneAt = profile?.streak_enabled
    ? getNextMilestone(profile.last_streak_milestone)
    : null;

  return {
    streakEnabled: profile?.streak_enabled ?? false,
    streakMode: profile?.streak_mode ?? "classic",
    currentStreak: profile?.current_streak ?? 0,
    longestStreak: profile?.longest_streak ?? 0,
    streakStars: profile?.streak_stars ?? 0,
    nextMilestoneAt,
    pendingMilestoneCelebration: pendingMilestone,
    milestoneCelebrationStreak: milestoneStreak,
    isNewRecord,
    dismissMilestone,
  };
}
