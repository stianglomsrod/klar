"use client";

import { motion } from "framer-motion";
import FlowerPot from "../FlowerPot";

// ── Types ────────────────────────────────────────────

type BloomStepProps = {
  bloomColorsSnapshot: string[];
  isBloomAnimating: boolean;
  onBloomComplete: () => void;
  onDismiss: () => void;
};

// ── Component ────────────────────────────────────────

export default function BloomStep({
  bloomColorsSnapshot,
  isBloomAnimating,
  onBloomComplete,
  onDismiss,
}: BloomStepProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-4 sm:py-6">
      {/* Rainbow celebration text */}
      <motion.h2
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          delay: 0.3,
          type: "spring",
          damping: 15,
          stiffness: 200,
        }}
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-transparent bg-clip-text text-center select-none pb-2 leading-normal"
        style={{
          backgroundImage:
            "linear-gradient(to right, #f87171, #facc15, #4ade80, #60a5fa, #a855f7)",
        }}
      >
        Ny blomst i hagen! 🌺
      </motion.h2>

      {/* Blooming flower */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center"
      >
        <FlowerPot
          size={
            typeof window !== "undefined" && window.innerWidth < 640 ? 200 : 280
          }
          petalsFilled={5}
          colors={bloomColorsSnapshot}
          isInteractive={false}
          hasPaint={false}
          isBloomAnimating={isBloomAnimating}
          onBloomComplete={onBloomComplete}
        />
      </motion.div>

      {/* Flowers collected count */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="text-base sm:text-lg text-gray-600 font-medium"
      >
        🌸🌺🌼
      </motion.p>

      {/* Dismiss button (appears after bloom animation) */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        onClick={onDismiss}
        className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white rounded-xl md:rounded-2xl font-bold text-sm sm:text-base shadow-lg transition-colors"
      >
        Fantastisk! ✨
      </motion.button>
    </div>
  );
}
