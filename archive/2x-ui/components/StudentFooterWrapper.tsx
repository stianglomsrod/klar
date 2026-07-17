"use client";

import { useState, useCallback, useEffect } from "react";
import StudentFooter from "./StudentFooter";
import AvatarPickerModal from "./student/AvatarPickerModal";
import LevelUpModal from "./LevelUpModal";
import StreakMilestoneModal from "./StreakMilestoneModal";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { useAttendanceStreak } from "@/hooks/useAttendanceStreak";

export default function StudentFooterWrapper() {
  const { profile, refresh } = useStudentProfile();
  const { selectReward } = useTaskCompletion();
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);

  // Use current_xp for progress bar (per-level accumulator)
  const userLevel = profile?.level ?? 1;
  const currentGoal = profile?.current_goal_total ?? 1000;
  const currentXp = profile?.current_xp ?? 0;
  const progressPercent = Math.round((currentXp / currentGoal) * 100);
  const userAvatar = profile?.avatar_url || "🦄";

  // Pending reward levels
  const pendingLevels = profile?.pending_reward_levels ?? [];
  const nextPendingLevel =
    pendingLevels.length > 0 ? Math.min(...pendingLevels) : null;

  // Get time tracking data
  const { currentActivity, timeRemaining, progress, loading } = useTimeTracker(
    profile?.id,
    profile?.class_id || undefined,
  );

  // Attendance streak
  const streak = useAttendanceStreak();

  // Deterministic welcome-overlay coordination:
  // The StreakMilestoneModal must wait until the WelcomeOverlay is dismissed.
  // If welcome was already seen (localStorage), it can show immediately.
  const [welcomeDone, setWelcomeDone] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("welcomeSeen")) {
      setWelcomeDone(true);
    }

    const handler = () => setWelcomeDone(true);
    window.addEventListener("welcomeDismissed", handler);
    return () => window.removeEventListener("welcomeDismissed", handler);
  }, []);

  const handleSelectReward = useCallback(
    async (
      rewardType: "petal" | "database",
      payload?: string,
      petalIndex?: number,
      rewardId?: string,
    ) => {
      if (nextPendingLevel === null) return;

      const result = await selectReward(
        rewardType,
        payload,
        petalIndex,
        rewardId,
        nextPendingLevel,
      );
      if (result.success) {
        setRewardModalOpen(false);
      }
    },
    [selectReward, nextPendingLevel],
  );

  const handleCloseRewardModal = useCallback(() => {
    setRewardModalOpen(false);
  }, []);

  return (
    <>
      <StudentFooter
        level={userLevel}
        progressPercent={progressPercent}
        currentXp={currentXp}
        currentGoal={currentGoal}
        avatar={userAvatar}
        timeTrackerEnabled={!loading}
        currentActivity={currentActivity}
        timeRemaining={timeRemaining}
        activityProgress={progress}
        studentId={profile?.id}
        classId={profile?.class_id || undefined}
        onAvatarClick={() => setAvatarPickerOpen(true)}
        showFlowerGarden={profile?.show_flower_garden ?? false}
        petalsProgress={profile?.petals_progress ?? 0}
        petalColors={profile?.petal_colors ?? []}
        pendingRewardCount={pendingLevels.length}
        onClaimReward={() => setRewardModalOpen(true)}
        streakEnabled={streak.streakEnabled}
        currentStreak={streak.currentStreak}
        longestStreak={streak.longestStreak}
        streakMode={streak.streakMode}
        nearestReward={streak.nearestReward}
      />

      {/* Avatar Picker Modal */}
      {profile?.id && (
        <AvatarPickerModal
          open={avatarPickerOpen}
          onClose={() => setAvatarPickerOpen(false)}
          currentAvatar={userAvatar}
          userId={profile.id}
          onAvatarChanged={refresh}
        />
      )}

      {/* Streak Milestone Modal — deterministic: only after welcome overlay dismissed */}
      <StreakMilestoneModal
        isOpen={streak.pendingMilestoneCelebration && welcomeDone}
        streakCount={streak.milestoneCelebrationStreak}
        isNewRecord={streak.isNewRecord}
        earnedRewards={streak.earnedRewards}
        onClose={streak.dismissMilestone}
      />

      {/* Global Pending Reward Modal */}
      {nextPendingLevel !== null && profile && (
        <LevelUpModal
          isOpen={rewardModalOpen}
          newLevel={nextPendingLevel}
          onClose={handleCloseRewardModal}
          onSelectReward={handleSelectReward}
          existingPetals={profile.petals_progress}
          existingColors={profile.petal_colors}
          showFlowerGarden={profile.show_flower_garden}
          studentId={profile.id}
        />
      )}
    </>
  );
}
