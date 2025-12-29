"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import StudentFooter from "./StudentFooter";

type Profile = {
  id: string;
  level: number;
  points_earned: number;
  current_goal_total?: number;
  current_avatar: string;
  petals_progress: number;
  flowers_collected: number;
};

export default function StudentFooterWrapper() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .limit(1)
        .single();

      if (profileError) {
        console.error("Feil ved henting av profil for footer:", profileError);
      } else {
        setProfile(profileData);

        // Set up Realtime subscription for profile changes
        const supabase = createClient();
        const channel = supabase
          .channel("realtime-profile")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${profileData.id}`,
            },
            (payload) => {
              // Update local state when profile changes in DB
              setProfile(payload.new as Profile);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    fetchProfile();
  }, []);

  // Extract profile data with defaults
  const currentGoal = profile?.current_goal_total || 100;
  // Compute current level directly from points so label always reflects reality
  // Display levels starting at 1 (0–99 pts = Level 1, etc.)
  const userLevel = Math.max(
    1,
    Math.floor((profile?.points_earned || 0) / currentGoal) + 1
  );
  // Use remainder so bar reflects progress within the current level
  const pointsRemainder = profile?.points_earned
    ? profile.points_earned % currentGoal
    : 0;
  const progressPercent = (pointsRemainder / currentGoal) * 100;
  const userAvatar = profile?.current_avatar || "🦄";

  return (
    <StudentFooter
      level={userLevel}
      progressPercent={progressPercent}
      avatar={userAvatar}
    />
  );
}
