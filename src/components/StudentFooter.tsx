"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

type StudentFooterProps = {
  level?: number;
  progressPercent?: number; // 0 - 100
  avatar?: string; // Emoji, e.g. 🦄 or ⚽
};

export default function StudentFooter({
  level = 3,
  progressPercent = 42,
  avatar = "🦄",
}: StudentFooterProps) {
  const [toolEnabled, setToolEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Wait 1.2 seconds (overlay fadeout is 0.8s + 0.4s buffer)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  // Juster denne for å sentrere avataren nøyaktig på prosent-streken
  const avatarOffset = `calc(${safeProgress}% - 0.75rem)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
        {/* Gamified Progress Section */}
        <div className="flex-1 pb-1">
          {" "}
          {/* pb-1 to make space for avatar shadow if needed */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-700 tracking-wide">
              LEVEL {level}
            </span>
            <span className="text-xs font-medium text-gray-500">
              {safeProgress}%
            </span>
          </div>
          <div className="relative h-3 w-full">
            {/* Background Track */}
            <div className="absolute inset-0 bg-gray-200 rounded-full overflow-hidden">
              {/* Green Progress Fill */}
              <div
                className="h-full bg-green-500 transition-all duration-500 ease-out"
                style={{ width: `${safeProgress}%` }}
              />
            </div>

            {/* Avatar marker - Positioned absolute relative to the bar container */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center select-none"
              style={{ left: avatarOffset }}
              initial={false}
              animate={{ left: avatarOffset }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
            >
              <div className="relative">
                <span className="text-2xl filter drop-shadow-md transform -translate-y-1 block">
                  {avatar}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Time Tool Toggle Button */}
        <button
          type="button"
          onClick={() => setToolEnabled((v) => !v)}
          title={toolEnabled ? "Skru av tidtaker" : "Skru på tidtaker"}
          className={`relative group flex items-center justify-center h-12 w-12 rounded-full border transition-all duration-300 ease-in-out
            ${
              toolEnabled
                ? "bg-indigo-50 border-indigo-400 text-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-300"
            }`}
        >
          <Timer
            className={`h-6 w-6 transition-transform duration-300 ${
              toolEnabled ? "scale-110" : "scale-100"
            }`}
            strokeWidth={toolEnabled ? 2.5 : 2}
          />

          {/* Optional: Small indicator dot for extra clarity */}
          {toolEnabled && (
            <span className="absolute top-0 right-0 h-3 w-3 bg-indigo-500 border-2 border-white rounded-full shadow-sm animate-pulse" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
