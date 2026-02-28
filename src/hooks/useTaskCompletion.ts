"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { DEFAULT_PETAL_COLOR } from "@/utils/constants";

// ── Types ────────────────────────────────────────────

export type CompletionResult = {
  shouldLevelUp: boolean;
  isNewHighLevel: boolean;
  newLevel: number;
};

export type RewardResult = {
  success: boolean;
  isFlowerComplete: boolean;
};

// ── Hook ─────────────────────────────────────────────

/**
 * Encapsulates the core task-completion flow:
 *   1. Mark task as completed in Supabase
 *   2. Calculate & persist XP / level changes
 *   3. Play success sound
 *   4. Return level-up info for the caller to show modals
 *
 * Also exposes `undoTask` (reverse of completion) and a shared
 * `playSuccessSound` helper.
 *
 * Does NOT handle quiz responses, media uploads, or UI state
 * (modals, animations) — those remain the caller's responsibility.
 */
export function useTaskCompletion() {
  const { profile, refresh: refreshProfile } = useStudentProfile();
  const [isCompleting, setIsCompleting] = useState(false);

  // ── Play sound ───────────────────────────────────
  const playSuccessSound = useCallback(() => {
    const audio = new Audio("/sounds/pling.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {
      /* Expected: autoplay blocked until user interaction */
    });
  }, []);

  // ── Complete a task ──────────────────────────────
  const completeTask = useCallback(
    async (
      taskId: string,
      pointsValue: number,
      meta?: { studentName?: string; taskTitle?: string },
    ): Promise<CompletionResult | null> => {
      if (!profile) return null;
      setIsCompleting(true);

      const supabase = createClient();

      try {
        // 1. Mark task as completed
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        if (taskError) throw taskError;

        // 2. Calculate XP / level
        const newPointsEarned = profile.points_earned + pointsValue;
        const goalTotal = profile.current_goal_total ?? 1000;
        const currentLevel = profile.level ?? 1;

        let finalCurrentXp = profile.current_xp + pointsValue;
        let newLevel = currentLevel;
        let shouldLevelUp = false;

        while (finalCurrentXp >= goalTotal) {
          newLevel += 1;
          finalCurrentXp -= goalTotal;
          shouldLevelUp = true;
        }

        const maxLevelReached = profile.max_level_reached ?? 1;
        const isNewHighLevel = newLevel > maxLevelReached;

        const profileUpdates: Record<string, unknown> = {
          points_earned: newPointsEarned,
          current_xp: finalCurrentXp,
          level: newLevel,
        };

        if (isNewHighLevel) {
          profileUpdates.max_level_reached = newLevel;

          // Track pending reward levels so they survive page refreshes
          const existingPending = profile.pending_reward_levels ?? [];
          const newPendingLevels: number[] = [];
          for (let l = maxLevelReached + 1; l <= newLevel; l++) {
            newPendingLevels.push(l);
          }
          profileUpdates.pending_reward_levels = [
            ...existingPending,
            ...newPendingLevels,
          ];
        }

        // 3. Persist profile updates
        const { error: profileError } = await supabase
          .from("student_profiles")
          .update(profileUpdates)
          .eq("id", profile.id);

        if (profileError) throw profileError;

        // 4. Refresh context so all components see the new data
        await refreshProfile();

        // 5. Sound
        playSuccessSound();

        // 6. Push notification to teacher (fire-and-forget)
        fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            studentId: profile.id,
            studentName: meta?.studentName ?? profile.full_name ?? "Elev",
            taskTitle: meta?.taskTitle ?? "Oppgave",
          }),
        }).catch(() => {
          /* Push is best-effort — silently ignore failures */
        });

        return { shouldLevelUp, isNewHighLevel, newLevel };
      } catch {
        return null;
      } finally {
        setIsCompleting(false);
      }
    },
    [profile, refreshProfile, playSuccessSound],
  );

  // ── Undo a completed task ────────────────────────
  const undoTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!profile) return false;

      const supabase = createClient();

      try {
        // 1. Fetch task to get points_value
        const { data: taskData, error: taskFetchError } = await supabase
          .from("tasks")
          .select("points_value")
          .eq("id", taskId)
          .single();

        if (taskFetchError || !taskData)
          throw taskFetchError || new Error("Task not found");

        // 2. Mark task as incomplete
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ is_completed: false })
          .eq("id", taskId);

        if (updateError) throw updateError;

        // 3. Recalculate - decrement points and XP (with level demotion)
        const currentXp = profile.current_xp;
        const currentLevel = profile.level ?? 1;
        const goalTotal = profile.current_goal_total ?? 1000;
        let rawXp = currentXp - taskData.points_value;
        let newLevel = currentLevel;

        while (rawXp < 0 && newLevel > 1) {
          newLevel -= 1;
          rawXp += goalTotal;
        }

        const newCurrentXp = Math.max(0, rawXp);
        const newPointsEarned = Math.max(
          0,
          profile.points_earned - taskData.points_value,
        );

        const { error: profileError } = await supabase
          .from("student_profiles")
          .update({
            points_earned: newPointsEarned,
            current_xp: newCurrentXp,
            level: newLevel,
            // Remove any pending rewards for levels being revoked
            ...(newLevel < currentLevel && {
              pending_reward_levels: (
                profile.pending_reward_levels ?? []
              ).filter((l) => l <= newLevel),
            }),
          })
          .eq("id", profile.id);

        if (profileError) throw profileError;

        // 4. Revoke rewards earned at levels that are being revoked
        if (newLevel < currentLevel) {
          await supabase
            .from("student_rewards")
            .delete()
            .eq("student_id", profile.id)
            .gt("earned_at_level", newLevel);
        }

        await refreshProfile();
        return true;
      } catch {
        return false;
      }
    },
    [profile, refreshProfile],
  );

  // ── Reward selection (petal / database) ──────────
  const selectReward = useCallback(
    async (
      rewardType: "petal" | "database",
      payload?: string,
      petalIndex?: number,
      rewardId?: string,
      forLevel?: number,
    ): Promise<RewardResult> => {
      if (!profile) return { success: false, isFlowerComplete: false };

      const supabase = createClient();

      try {
        if (rewardType === "petal" && payload) {
          const currentColors = profile.petal_colors || [];
          const normalizedColors = Array.from(
            { length: 5 },
            (_, i) => currentColors[i] || DEFAULT_PETAL_COLOR,
          );
          const targetIndex =
            typeof petalIndex === "number" && petalIndex >= 0 && petalIndex < 5
              ? petalIndex
              : 0;

          normalizedColors[targetIndex] = payload;

          const newPetalsProgress = normalizedColors.filter(
            (c) => c && c.trim().length > 0 && c.trim() !== DEFAULT_PETAL_COLOR,
          ).length;

          const isFlowerComplete = newPetalsProgress >= 5;

          const profileUpdates: Record<string, unknown> = {
            petals_progress: isFlowerComplete ? 0 : newPetalsProgress,
            petal_colors: isFlowerComplete ? [] : normalizedColors,
          };

          if (isFlowerComplete) {
            profileUpdates.flowers_collected = profile.flowers_collected + 1;
            // Persist the completed flower's colors permanently
            profileUpdates.completed_flower_colors = [
              ...(profile.completed_flower_colors ?? []),
              normalizedColors,
            ];
          }

          // Clear the pending reward for this level (atomic with petal update)
          if (typeof forLevel === "number") {
            profileUpdates.pending_reward_levels = (
              profile.pending_reward_levels ?? []
            ).filter((l) => l !== forLevel);
          }

          const { error } = await supabase
            .from("student_profiles")
            .update(profileUpdates)
            .eq("id", profile.id);

          if (error) throw error;

          await refreshProfile();
          return { success: true, isFlowerComplete };
        } else if (rewardType === "database" && rewardId) {
          // Claim a database reward (coupon) at the target level
          const level = forLevel ?? profile.level ?? 1;
          const { error } = await supabase.from("student_rewards").upsert(
            {
              student_id: profile.id,
              reward_id: rewardId,
              is_redeemed: false,
              date_earned: new Date().toISOString(),
              earned_at_level: level,
            },
            { onConflict: "student_id,reward_id,earned_at_level" },
          );

          if (error) throw error;

          // Clear the pending reward for this level
          if (typeof forLevel === "number") {
            const updatedPending = (profile.pending_reward_levels ?? []).filter(
              (l) => l !== forLevel,
            );
            await supabase
              .from("student_profiles")
              .update({ pending_reward_levels: updatedPending })
              .eq("id", profile.id);
          }

          await refreshProfile();
        }

        return { success: true, isFlowerComplete: false };
      } catch {
        return { success: false, isFlowerComplete: false };
      }
    },
    [profile, refreshProfile],
  );

  return {
    profile,
    isCompleting,
    completeTask,
    undoTask,
    selectReward,
    playSuccessSound,
    refreshProfile,
  };
}
