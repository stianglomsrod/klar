"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type XpProgressBarProps = {
  level: number;
  progressPercent: number;
  currentXp: number;
  currentGoal: number;
  avatar: string;
  onAvatarClick?: () => void;
};

export default function XpProgressBar({
  level,
  progressPercent,
  currentXp,
  currentGoal,
  avatar,
  onAvatarClick,
}: XpProgressBarProps) {
  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  // XP display mode: toggle between percentage and absolute values
  const [xpDisplayMode, setXpDisplayMode] = useState<"percent" | "xp">(() => {
    if (typeof window === "undefined") return "percent";
    return (
      (localStorage.getItem("xp-display-mode") as "percent" | "xp") ||
      "percent"
    );
  });

  const toggleXpDisplay = () => {
    setXpDisplayMode((prev) => {
      const next = prev === "percent" ? "xp" : "percent";
      localStorage.setItem("xp-display-mode", next);
      return next;
    });
  };

  const avatarOffset = `calc(${safeProgress}% - 0.75rem)`;

  return (
    <div className="flex-1 pb-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-700 tracking-wide">
          LEVEL {level}
        </span>
        <button
          type="button"
          onClick={toggleXpDisplay}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none"
          aria-label="Bytt XP-visning"
        >
          {xpDisplayMode === "percent"
            ? `${safeProgress}%`
            : `${currentXp} / ${currentGoal}`}
        </button>
      </div>
      <div className="relative h-3 w-full">
        {/* Light Background Track */}
        <div className="absolute inset-0 bg-slate-200 rounded-full overflow-hidden ring-1 ring-slate-300/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,197,94,0.4),0_4px_10px_-6px_rgba(16,185,129,0.5)]"
            style={{ width: `${safeProgress}%` }}
          />
        </div>

        {/* Avatar marker */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center select-none"
          style={{ left: avatarOffset }}
          initial={false}
          animate={{ left: avatarOffset }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <button
            type="button"
            onClick={onAvatarClick}
            className="relative group cursor-pointer"
            aria-label="Bytt avatar"
          >
            {avatar && avatar.startsWith("http") ? (
              <img
                src={avatar}
                alt="User avatar"
                className="w-7 h-7 rounded-full border-2 border-white shadow-md object-cover group-hover:ring-2 group-hover:ring-indigo-400 transition-all"
              />
            ) : (
              <span className="text-2xl filter drop-shadow-md transform -translate-y-1 block group-hover:scale-125 transition-transform">
                {avatar}
              </span>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
