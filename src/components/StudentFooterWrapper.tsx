"use client";

import StudentFooter from "./StudentFooter";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

export default function StudentFooterWrapper() {
  const { profile } = useStudentProfile();

  // Use current_xp for progress bar (per-level accumulator)
  const userLevel = profile?.level ?? 1;
  const currentGoal = profile?.current_goal_total ?? 1000;
  const currentXp = profile?.current_xp ?? 0;
  const progressPercent = (currentXp / currentGoal) * 100;
  const userAvatar = profile?.avatar_url || "🦄";

  return (
    <StudentFooter
      level={userLevel}
      progressPercent={progressPercent}
      avatar={userAvatar}
    />
  );
}
