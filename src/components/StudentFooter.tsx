"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import StudentHelpButton from "./student/StudentHelpButton";
import XpProgressBar from "./student-footer/XpProgressBar";
import FlowerTeaser from "./student-footer/FlowerTeaser";
import PendingRewardBadge from "./student-footer/PendingRewardBadge";
import TimeTrackerWidget from "./student-footer/TimeTrackerWidget";
import StreakWidget from "./student-footer/StreakWidget";

type StudentFooterProps = {
  level?: number;
  progressPercent?: number; // 0 - 100
  currentXp?: number;
  currentGoal?: number;
  avatar?: string; // Emoji, e.g. 🦄 or ⚽
  // Time tracker props
  timeTrackerEnabled?: boolean;
  currentActivity?: {
    title: string;
    emoji: string;
    type: "lesson" | "break" | "free" | "upcoming";
    endTime: string | null;
  };
  timeRemaining?: string;
  activityProgress?: number;
  // Help button props
  studentId?: string;
  classId?: string;
  /** Called when the student clicks their avatar to change it. */
  onAvatarClick?: () => void;
  // Flower teaser props
  showFlowerGarden?: boolean;
  petalsProgress?: number;
  petalColors?: string[];
  // Pending reward props
  pendingRewardCount?: number;
  onClaimReward?: () => void;
  // Streak props
  streakEnabled?: boolean;
  currentStreak?: number;
  longestStreak?: number;
  streakMode?: "classic" | "accumulated";
  nearestReward?: {
    emoji: string;
    title: string;
    currentProgress: number;
    requiredDays: number;
  } | null;
};

export default function StudentFooter({
  level = 3,
  progressPercent = 42,
  currentXp = 0,
  currentGoal = 1000,
  avatar = "🦄",
  timeTrackerEnabled = false,
  currentActivity,
  timeRemaining = "--",
  activityProgress = 0,
  studentId,
  classId,
  onAvatarClick,
  showFlowerGarden = false,
  petalsProgress = 0,
  petalColors = [],
  pendingRewardCount = 0,
  onClaimReward,
  streakEnabled = false,
  currentStreak = 0,
  longestStreak = 0,
  streakMode = "classic",
  nearestReward = null,
}: StudentFooterProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Wait 1.2 seconds (overlay fadeout is 0.8s + 0.4s buffer)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to class queue open/close
  useEffect(() => {
    if (!classId) {
      setIsQueueOpen(false);
      return;
    }

    let isMounted = true;

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("is_queue_open")
        .eq("id", classId)
        .single();

      if (!error && data && isMounted) {
        setIsQueueOpen(Boolean(data.is_queue_open));
      }
    };

    fetchInitial();

    const channel = supabase
      .channel(`classes-queue-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classes",
          filter: `id=eq.${classId}`,
        },
        (payload) => {
          const next = (payload.new as { is_queue_open?: boolean })
            ?.is_queue_open;
          setIsQueueOpen(Boolean(next));
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [classId, supabase]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed bottom-0 inset-x-0 z-40"
    >
      {/* Main Footer Bar */}
      <div className="bg-white/85 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          {/* XP Progress */}
          <XpProgressBar
            level={level}
            progressPercent={progressPercent}
            currentXp={currentXp}
            currentGoal={currentGoal}
            avatar={avatar}
            onAvatarClick={onAvatarClick}
          />

          {/* Flower Teaser — mini garden link */}
          {showFlowerGarden && (
            <FlowerTeaser
              petalsProgress={petalsProgress}
              petalColors={petalColors}
            />
          )}

          {/* Attendance Streak */}
          {streakEnabled && (
            <StreakWidget
              currentStreak={currentStreak}
              longestStreak={longestStreak}
              streakMode={streakMode}
              nearestReward={nearestReward}
            />
          )}

          {/* Pending Reward Gift */}
          <PendingRewardBadge
            count={pendingRewardCount}
            onClaim={onClaimReward}
          />

          {/* Time Tracker (button + popover) */}
          <TimeTrackerWidget
            currentActivity={currentActivity}
            timeRemaining={timeRemaining}
            activityProgress={activityProgress}
          />

          {/* Help Button */}
          {studentId && classId && isQueueOpen && (
            <StudentHelpButton studentId={studentId} classId={classId} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
