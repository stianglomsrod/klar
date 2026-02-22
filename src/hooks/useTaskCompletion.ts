"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

// ── Types ────────────────────────────────────────────

export type CompletionResult = {
  shouldLevelUp: boolean;
  isNewHighLevel: boolean;
  newLevel: number;
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
    audio
      .play()
      .catch((e: unknown) =>
        console.log("Audio play failed (user interaction needed first):", e),
      );
  }, []);

  // ── Complete a task ──────────────────────────────
  const completeTask = useCallback(
    async (
      taskId: string,
      pointsValue: number,
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

        return { shouldLevelUp, isNewHighLevel, newLevel };
      } catch (error) {
        console.error("Feil ved fullføring av oppgave:", error);
        alert("Noe gikk galt. Prøv igjen.");
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
          })
          .eq("id", profile.id);

        if (profileError) throw profileError;

        await refreshProfile();
        return true;
      } catch (error) {
        console.error("Feil ved angring av oppgave:", error);
        alert("Noe gikk galt. Prøv igjen.");
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
    ): Promise<boolean> => {
      if (!profile) return false;

      const supabase = createClient();

      try {
        if (rewardType === "petal" && payload) {
          const currentColors = profile.petal_colors || [];
          const normalizedColors = Array.from(
            { length: 5 },
            (_, i) => currentColors[i] || "#E0E0E0",
          );
          const targetIndex =
            typeof petalIndex === "number" && petalIndex >= 0 && petalIndex < 5
              ? petalIndex
              : 0;

          normalizedColors[targetIndex] = payload;

          const newPetalsProgress = normalizedColors.filter(
            (c) => c && c.trim().length > 0 && c.trim() !== "#E0E0E0",
          ).length;

          const isFlowerComplete = newPetalsProgress >= 5;

          const profileUpdates: Record<string, unknown> = {
            petals_progress: isFlowerComplete ? 0 : newPetalsProgress,
            petal_colors: isFlowerComplete ? [] : normalizedColors,
          };

          if (isFlowerComplete) {
            profileUpdates.flowers_collected = profile.flowers_collected + 1;
          }

          const { error } = await supabase
            .from("student_profiles")
            .update(profileUpdates)
            .eq("id", profile.id);

          if (error) throw error;

          await refreshProfile();
        } else if (rewardType === "database" && rewardId) {
          // TODO: Implement reward claim logic
        }

        return true;
      } catch (error) {
        console.error("Feil ved valg av belønning:", error);
        alert("Noe gikk galt. Prøv igjen.");
        return false;
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
