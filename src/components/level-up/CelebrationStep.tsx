"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailableReward } from "@/hooks/useAvailableRewards";

// ── Types ────────────────────────────────────────────

type CelebrationStepProps = {
  newLevel: number;
  showFlowerGarden: boolean;
  rewards: AvailableReward[];
  loadingRewards: boolean;
  savingReward: boolean;
  onSelectPetal: () => void;
  onSelectDatabaseReward: (rewardId: string) => void;
};

// ── Component ────────────────────────────────────────

export default function CelebrationStep({
  newLevel,
  showFlowerGarden,
  rewards,
  loadingRewards,
  savingReward,
  onSelectPetal,
  onSelectDatabaseReward,
}: CelebrationStepProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);
      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [rewards, showFlowerGarden]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 320;
    const newScrollLeft =
      scrollContainerRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);
    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  return (
    <div className="text-center flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="flex-shrink-0"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 mb-3 md:mb-4">
          GRATULERER! 🎉
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-2"
        >
          Du er nå i Level {newLevel}!
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-base sm:text-lg text-gray-600 mb-4 md:mb-6"
        >
          Velg din premie:
        </motion.p>
      </motion.div>

      {/* Scrollable Reward Grid */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Horizontal scroll container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex gap-2 sm:gap-3 md:gap-6 px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 min-w-min">
            {/* Flower Reward */}
            {showFlowerGarden && (
              <motion.button
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSelectPetal}
                className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-300 hover:border-pink-400 rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="text-4xl sm:text-5xl md:text-6xl mb-2 md:mb-3">
                  🌸
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 md:mb-2">
                  Fargelegg Kronblad
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Velg en farge til blomsten din
                </p>
              </motion.button>
            )}

            {/* Database Rewards */}
            {loadingRewards ? (
              <div className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 flex items-center justify-center py-8 sm:py-10 md:py-12">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-500 text-center text-sm sm:text-base"
                >
                  Laster premier...
                </motion.div>
              </div>
            ) : rewards.length === 0 && !showFlowerGarden ? (
              <div className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 flex items-center justify-center py-8 sm:py-10 md:py-12">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-500 text-center text-sm sm:text-base"
                >
                  Ingen premier tilgjengelig
                </motion.div>
              </div>
            ) : (
              rewards.map((reward, index) => (
                <motion.button
                  key={reward.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay:
                      0.7 +
                      (showFlowerGarden ? index * 0.1 : index * 0.1),
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectDatabaseReward(reward.id)}
                  disabled={savingReward}
                  className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-300 hover:border-blue-400 rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-4xl sm:text-5xl md:text-6xl mb-2 md:mb-3">
                    {savingReward ? "⏳" : reward.emoji || "🎁"}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 md:mb-2">
                    {reward.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {savingReward
                      ? "Lagrer premie..."
                      : reward.description || "En fantastisk premie!"}
                  </p>
                </motion.button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
