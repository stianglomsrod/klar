import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// ── Types ────────────────────────────────────────────

export type AvailableReward = {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  is_recurring?: boolean;
};

// ── Hook ─────────────────────────────────────────────

/**
 * Fetches rewards available to a student, filtering out those that have
 * reached their `max_uses` limit.  Shared by LevelUpModal and HalfwayModal.
 */
export function useAvailableRewards(
  studentId: string | undefined,
  enabled: boolean,
) {
  const [rewards, setRewards] = useState<AvailableReward[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !studentId) return;

    let cancelled = false;

    const fetchRewards = async () => {
      setLoading(true);
      try {
        const supabase = createClient();

        const [rewardsRes, earnedRes] = await Promise.all([
          supabase
            .from("rewards")
            .select("id, title, description, emoji, is_recurring, max_uses, specific_student_ids")
            .or(
              `specific_student_ids.eq.{},specific_student_ids.cs.{${studentId}}`,
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("student_rewards")
            .select("reward_id")
            .eq("student_id", studentId),
        ]);

        if (cancelled) return;

        if (!rewardsRes.error && rewardsRes.data) {
          // Count how many times each reward has been earned
          const earnedCounts = new Map<string, number>();
          for (const r of earnedRes.data ?? []) {
            earnedCounts.set(
              r.reward_id,
              (earnedCounts.get(r.reward_id) ?? 0) + 1,
            );
          }

          // Filter out rewards that have reached their max_uses limit
          const filtered = rewardsRes.data.filter((r) => {
            if (r.max_uses == null) return true; // unlimited
            const used = earnedCounts.get(r.id) ?? 0;
            return used < r.max_uses;
          });

          setRewards(filtered);
        }
      } catch {
        // Silent — reward fetch is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRewards();

    return () => {
      cancelled = true;
    };
  }, [enabled, studentId]);

  return { rewards, loading };
}
