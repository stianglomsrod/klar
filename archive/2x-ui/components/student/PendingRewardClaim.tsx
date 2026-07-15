"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import LevelUpModal from "@/components/LevelUpModal";

/**
 * Floating banner that appears on the student dashboard when there
 * are unclaimed level-up rewards (pending_reward_levels is non-empty).
 *
 * Clicking the banner re-opens the LevelUpModal for the first
 * pending level. After the student selects a reward, the pending
 * level is cleared from the database and the banner updates.
 *
 * If multiple levels are pending (e.g. student jumped 2 levels in
 * one task), the banner stays visible and can be clicked again for
 * the next level.
 */
export default function PendingRewardClaim() {
  const { profile } = useStudentProfile();
  const { selectReward } = useTaskCompletion();
  const [showModal, setShowModal] = useState(false);

  const pendingLevels = profile?.pending_reward_levels ?? [];
  const nextPendingLevel =
    pendingLevels.length > 0 ? Math.min(...pendingLevels) : null;

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
        nextPendingLevel, // forLevel
      );
      if (result.success) {
        setShowModal(false);
        // Profile is refreshed inside selectReward — pending_reward_levels is updated
      }
    },
    [selectReward, nextPendingLevel],
  );

  const handleClose = useCallback(() => {
    setShowModal(false);
    // Reward stays in pending_reward_levels — banner will still show
  }, []);

  // Nothing pending — render nothing
  if (!profile || pendingLevels.length === 0) return null;

  return (
    <>
      {/* Floating gift banner */}
      <AnimatePresence>
        {!showModal && (
          <motion.button
            key="pending-reward-banner"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowModal(true)}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40
              bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500
              text-white font-bold px-6 py-3 rounded-2xl shadow-2xl
              flex items-center gap-3 text-base sm:text-lg
              animate-bounce-gentle"
            style={{
              animation: "bounce-gentle 2s ease-in-out infinite",
            }}
          >
            <span className="text-2xl">🎁</span>
            <span>
              Du har{" "}
              {pendingLevels.length === 1
                ? "en premie"
                : `${pendingLevels.length} premier`}{" "}
              å hente!
            </span>
            <span className="text-2xl">✨</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Inline CSS for the gentle bounce animation */}
      <style jsx>{`
        @keyframes bounce-gentle {
          0%,
          100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(-8px);
          }
        }
      `}</style>

      {/* Re-usable LevelUpModal for the pending reward */}
      {nextPendingLevel !== null && (
        <LevelUpModal
          isOpen={showModal}
          newLevel={nextPendingLevel}
          onClose={handleClose}
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
