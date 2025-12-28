"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import StudentFooter from "./StudentFooter";

type Profile = {
  id: string;
  level: number;
  points_earned: number;
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
      }
    };

    fetchProfile();
  }, []);

  // Extract profile data with defaults
  const userLevel = profile?.level || 1;
  const progressPercent = profile?.petals_progress || 0;
  const userAvatar = profile?.current_avatar || "🦄";

  return (
    <StudentFooter
      level={userLevel}
      progressPercent={progressPercent}
      avatar={userAvatar}
    />
  );
}
