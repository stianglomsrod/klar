"use client";

import { motion } from "framer-motion";

type PendingRewardBadgeProps = {
  count: number;
  onClaim?: () => void;
};

export default function PendingRewardBadge({
  count,
  onClaim,
}: PendingRewardBadgeProps) {
  if (count <= 0) return null;

  return (
    <motion.button
      type="button"
      onClick={onClaim}
      className="relative flex items-center justify-center flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-yellow-300 via-pink-400 to-purple-500 shadow-lg cursor-pointer"
      title="Du har premier å hente!"
      animate={{
        scale: [1, 1.12, 1],
        boxShadow: [
          "0 0 0px rgba(251,191,36,0)",
          "0 0 16px rgba(251,191,36,0.6)",
          "0 0 0px rgba(251,191,36,0)",
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      whileTap={{ scale: 0.9 }}
      aria-label={`Du har ${count} ${count === 1 ? "premie" : "premier"} å hente`}
    >
      <span className="text-xl leading-none select-none">🎁</span>
      {count > 1 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
          {count}
        </span>
      )}
    </motion.button>
  );
}
