"use client";

import StudentFooter from "./StudentFooter";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { useTimeTracker } from "@/hooks/useTimeTracker";

export default function StudentFooterWrapper() {
  const { profile } = useStudentProfile();

  // Use current_xp for progress bar (per-level accumulator)
  const userLevel = profile?.level ?? 1;
  const currentGoal = profile?.current_goal_total ?? 1000;
  const currentXp = profile?.current_xp ?? 0;
  const progressPercent = (currentXp / currentGoal) * 100;
  const userAvatar = profile?.avatar_url || "🦄";

  // Get time tracking data
  const { currentActivity, timeRemaining, progress, loading } = useTimeTracker(
    profile?.id,
    profile?.class_id
  );

  return (
    <StudentFooter
      level={userLevel}
      progressPercent={progressPercent}
      avatar={userAvatar}
      timeTrackerEnabled={!loading}
      currentActivity={currentActivity}
      timeRemaining={timeRemaining}
      activityProgress={progress}
    />
  );
}
