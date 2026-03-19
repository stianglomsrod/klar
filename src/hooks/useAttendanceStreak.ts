"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

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

export type NearestReward = {
  emoji: string;
  title: string;
  currentProgress: number;
  requiredDays: number;
};

export type EarnedReward = {
  emoji: string;
  title: string;
};

export type AttendanceStreakState = {
  streakEnabled: boolean;
  streakMode: "classic" | "accumulated";
  currentStreak: number;
  longestStreak: number;
  nearestReward: NearestReward | null;
  pendingMilestoneCelebration: boolean;
  earnedRewards: EarnedReward[];
  milestoneCelebrationStreak: number;
  isNewRecord: boolean;
  dismissMilestone: () => void;
};

// ── Progress entry stored per reward in attendance_reward_progress JSONB ──
type ProgressEntry = {
  baseline: number;       // current_streak when reward was first observed
  last_granted_at: number; // current_streak at last grant (starts at baseline)
};

// ── Shared reward evaluation (used by both new-day and same-day paths) ──

async function evaluateAttendanceRewards(
  studentId: string,
  currentStreak: number,
  existingProgress: Record<string, ProgressEntry>,
  streakReset: boolean,
): Promise<{
  granted: EarnedReward[];
  updatedProgress: Record<string, ProgressEntry>;
  rewardsToInsert: { student_id: string; reward_id: string; earned_at_level: number }[];
}> {
  const supabase = createClient();

  const { data: attendanceRewards } = await supabase
    .from("rewards")
    .select(
      "id, title, emoji, cost_value, is_recurring, max_uses, specific_student_ids",
    )
    .eq("cost_type", "attendance")
    .or(
      `specific_student_ids.is.null,specific_student_ids.eq.{},specific_student_ids.cs.{${studentId}}`,
    );


  const { data: earnedRows } = await supabase
    .from("student_rewards")
    .select("reward_id")
    .eq("student_id", studentId);

  const earnedCounts = new Map<string, number>();
  for (const r of earnedRows ?? []) {
    earnedCounts.set(
      r.reward_id,
      (earnedCounts.get(r.reward_id) ?? 0) + 1,
    );
  }

  const progress: Record<string, ProgressEntry> = { ...existingProgress };
  const granted: EarnedReward[] = [];
  const rewardsToInsert: { student_id: string; reward_id: string; earned_at_level: number }[] = [];

  for (const reward of attendanceRewards ?? []) {
    const costValue = reward.cost_value ?? 1;

    let entry = progress[reward.id];
    if (!entry) {
      entry = { baseline: currentStreak, last_granted_at: currentStreak };
      progress[reward.id] = entry;
    }

    if (streakReset) {
      entry.baseline = currentStreak;
      entry.last_granted_at = currentStreak;
    }

    // Defensive: if progress is stale (e.g. streak reset not detected), re-baseline
    if (entry.last_granted_at > currentStreak) {
      entry.baseline = currentStreak;
      entry.last_granted_at = currentStreak;
    }

    const used = earnedCounts.get(reward.id) ?? 0;
    if (reward.max_uses != null && used >= reward.max_uses) continue;
    if (!reward.is_recurring && used > 0) continue;

    const daysSinceGrant = currentStreak - entry.last_granted_at;

    let grants = 0;
    if (daysSinceGrant >= costValue) {
      if (reward.is_recurring) {
        grants = Math.floor(daysSinceGrant / costValue);
        if (reward.max_uses != null) {
          grants = Math.min(grants, reward.max_uses - used);
        }
      } else {
        grants = 1;
      }
    }

    if (grants > 0) {
      for (let i = 0; i < grants; i++) {
        // earned_at_level = streak day when this specific grant was earned
        const grantStreakDay = entry.last_granted_at + (i + 1) * costValue;
        rewardsToInsert.push({ student_id: studentId, reward_id: reward.id, earned_at_level: grantStreakDay });
        granted.push({ emoji: reward.emoji ?? "\uD83C\uDF81", title: reward.title });
      }
      entry.last_granted_at = entry.last_granted_at + grants * costValue;
    }
  }

  return { granted, updatedProgress: progress, rewardsToInsert };
}

// ── Hook ─────────────────────────────────────────────────

export function useAttendanceStreak(): AttendanceStreakState {
  const { profile, refresh } = useStudentProfile();
  const [pendingMilestone, setPendingMilestone] = useState(false);
  const [earnedRewards, setEarnedRewards] = useState<EarnedReward[]>([]);
  const [milestoneStreak, setMilestoneStreak] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [nearestReward, setNearestReward] = useState<NearestReward | null>(
    null,
  );
  const processedRef = useRef(false);
  const lastRewardCheckRef = useRef('');

  // ── Effect 1: Process streak + grant rewards on new login day ──
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
        newCurrentStreak = profile.current_streak + 1;
        newLongestStreak = newCurrentStreak;
      } else {
        if (lastLogin && isYesterday(lastLogin, now)) {
          newCurrentStreak = profile.current_streak + 1;
        } else {
          newCurrentStreak = 1;
        }
        newLongestStreak = Math.max(profile.longest_streak, newCurrentStreak);
      }

      // ── Evaluate and grant attendance rewards ──
      const streakReset = newCurrentStreak < (profile.current_streak ?? 0);
      const { granted, updatedProgress, rewardsToInsert } =
        await evaluateAttendanceRewards(
          profile.id,
          newCurrentStreak,
          profile.attendance_reward_progress ?? {},
          streakReset,
        );

      // ── Persist: streak + progress (+ granted rewards) ──
      const updates: Record<string, unknown> = {
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_login_date: today,
        attendance_reward_progress: updatedProgress,
      };

      const { error } = await supabase
        .from("student_profiles")
        .update(updates)
        .eq("id", profile.id);

      if (error) {
        processedRef.current = false;
        return;
      }

      if (rewardsToInsert.length > 0) {
        await supabase
          .from("student_rewards")
          .upsert(rewardsToInsert, { onConflict: "student_id,reward_id,earned_at_level", ignoreDuplicates: true });
      }

      await refresh();

      // Update fingerprint so Effect 3 knows this data was already processed
      lastRewardCheckRef.current = `${newCurrentStreak}:${JSON.stringify(updatedProgress)}`;

      // Set celebration state
      if (granted.length > 0) {
        setEarnedRewards(granted);
        setMilestoneStreak(newCurrentStreak);
        setIsNewRecord(newLongestStreak > profile.longest_streak);
        setPendingMilestone(true);
      }
    };

    processStreak();
  }, [profile, refresh]);

  // ── Effect 3: Check for uncredited rewards on same-day mount ──
  // Catches: teacher-assigned rewards mid-session, manual data adjustments,
  // or any situation where streak was already processed today but rewards qualify.
  useEffect(() => {
    if (!profile) return;
    if (!profile.streak_enabled) return;
    if (pendingMilestone) return;

    const today = toLocalDateString(new Date());
    if (profile.last_login_date !== today) return; // Effect 1 handles new days

    // Fingerprint guard: only re-check if attendance-relevant data changed
    const fingerprint = `${profile.current_streak}:${JSON.stringify(profile.attendance_reward_progress ?? {})}`;
    if (lastRewardCheckRef.current === fingerprint) return;
    lastRewardCheckRef.current = fingerprint;

    const checkRewards = async () => {
      const { granted, updatedProgress, rewardsToInsert } =
        await evaluateAttendanceRewards(
          profile.id,
          profile.current_streak,
          profile.attendance_reward_progress ?? {},
          false,
        );

      if (granted.length > 0) {
        const supabase = createClient();
        await supabase
          .from("student_profiles")
          .update({ attendance_reward_progress: updatedProgress })
          .eq("id", profile.id);
        await supabase
          .from("student_rewards")
          .upsert(rewardsToInsert, { onConflict: "student_id,reward_id,earned_at_level", ignoreDuplicates: true });
        await refresh();

        setEarnedRewards(granted);
        setMilestoneStreak(profile.current_streak);
        setIsNewRecord(false);
        setPendingMilestone(true);
      } else {
        // Persist new baselines even without grants (so Effect 1 uses correct baselines next day)
        const existingKeys = Object.keys(profile.attendance_reward_progress ?? {});
        const updatedKeys = Object.keys(updatedProgress);
        if (updatedKeys.length > existingKeys.length) {
          const supabase = createClient();
          await supabase
            .from("student_profiles")
            .update({ attendance_reward_progress: updatedProgress })
            .eq("id", profile.id);
        }
      }
    };

    checkRewards();
  }, [profile, refresh, pendingMilestone]);

  // ── Effect 2: Compute nearest attendance reward for popover ──
  useEffect(() => {
    if (!profile) return;
    if (!profile.streak_enabled) return;

    let cancelled = false;

    const computeNearest = async () => {
      const supabase = createClient();

      const { data: attendanceRewards } = await supabase
        .from("rewards")
        .select(
          "id, title, emoji, cost_value, is_recurring, max_uses, specific_student_ids",
        )
        .eq("cost_type", "attendance")
        .or(
          `specific_student_ids.is.null,specific_student_ids.eq.{},specific_student_ids.cs.{${profile.id}}`,
        );

      if (cancelled || !attendanceRewards || attendanceRewards.length === 0) {
        if (!cancelled) setNearestReward(null);
        return;
      }

      const { data: earnedRows } = await supabase
        .from("student_rewards")
        .select("reward_id")
        .eq("student_id", profile.id);

      if (cancelled) return;

      const earnedCounts = new Map<string, number>();
      for (const r of earnedRows ?? []) {
        earnedCounts.set(
          r.reward_id,
          (earnedCounts.get(r.reward_id) ?? 0) + 1,
        );
      }

      const progress: Record<string, ProgressEntry> =
        profile.attendance_reward_progress ?? {};
      let best: NearestReward | null = null;
      let bestDaysRemaining = Infinity;

      for (const reward of attendanceRewards) {
        const costValue = reward.cost_value ?? 1;
        const used = earnedCounts.get(reward.id) ?? 0;

        // Skip exhausted rewards
        if (reward.max_uses != null && used >= reward.max_uses) continue;
        if (!reward.is_recurring && used > 0) continue;

        const entry = progress[reward.id];
        const lastGrantedAt = entry?.last_granted_at ?? profile.current_streak;
        const daysSinceGrant = profile.current_streak - lastGrantedAt;
        const progressInCycle = daysSinceGrant % costValue;
        const daysRemaining = costValue - progressInCycle;

        if (daysRemaining < bestDaysRemaining) {
          bestDaysRemaining = daysRemaining;
          best = {
            emoji: reward.emoji ?? "🎁",
            title: reward.title,
            currentProgress: progressInCycle,
            requiredDays: costValue,
          };
        }
      }

      if (!cancelled) setNearestReward(best);
    };

    computeNearest();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const dismissMilestone = useCallback(() => {
    setPendingMilestone(false);
    setEarnedRewards([]);
  }, []);

  const state = {
    streakEnabled: profile?.streak_enabled ?? false,
    streakMode: profile?.streak_mode ?? "classic",
    currentStreak: profile?.current_streak ?? 0,
    longestStreak: profile?.longest_streak ?? 0,
    nearestReward,
    pendingMilestoneCelebration: pendingMilestone,
    earnedRewards,
    milestoneCelebrationStreak: milestoneStreak,
    isNewRecord,
    dismissMilestone,
  };

  return state;
}
