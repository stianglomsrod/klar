"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

type StreakMilestoneModalProps = {
  isOpen: boolean;
  streakCount: number;
  isNewRecord: boolean;
  onClose: () => void;
};

export default function StreakMilestoneModal({
  isOpen,
  streakCount,
  isNewRecord,
  onClose,
}: StreakMilestoneModalProps) {
  // Confetti burst on open
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      // Star-themed confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.35 },
        colors: ["#FFD700", "#FFA500", "#FF8C00", "#FBBF24", "#F59E0B"],
        gravity: 0.7,
        scalar: 1.0,
        ticks: 150,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 300,
              delay: 0.1,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center overflow-hidden"
          >
            {/* Decorative top glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-300/20 rounded-full blur-3xl -translate-y-1/2" />

            <div className="relative z-10 space-y-4">
              {/* Star icon */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  damping: 12,
                  stiffness: 200,
                  delay: 0.3,
                }}
                className="text-6xl leading-none"
              >
                ⭐
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-2xl font-extrabold text-slate-900"
              >
                Nærværsstjerne!
              </motion.h2>

              {/* Streak count */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-1"
              >
                <p className="text-4xl font-black text-amber-500">
                  🔥 {streakCount}
                </p>
                <p className="text-sm text-slate-500 font-medium">
                  dager med nærvær
                </p>
              </motion.div>

              {/* New record badge */}
              {isNewRecord && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-full px-4 py-1.5 text-sm font-semibold border border-amber-200"
                >
                  <span>🏆</span>
                  <span>Ny personlig rekord!</span>
                </motion.div>
              )}

              {/* Dismiss button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={onClose}
                className="mt-4 w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 text-base"
              >
                Kult! 🌟
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
