"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type StreakWidgetProps = {
  currentStreak: number;
  longestStreak: number;
  streakMode: "classic" | "accumulated";
  streakStars: number;
  nextMilestoneAt: number | null;
};

export default function StreakWidget({
  currentStreak,
  longestStreak,
  streakMode,
  streakStars,
  nextMilestoneAt,
}: StreakWidgetProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({
    bottom: 96,
    right: 32,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Bounce on streak change
  const [bounce, setBounce] = useState(false);
  const prevStreakRef = useRef(currentStreak);
  useEffect(() => {
    if (currentStreak !== prevStreakRef.current && currentStreak > 0) {
      const startTimer = setTimeout(() => setBounce(true), 0);
      const endTimer = setTimeout(() => setBounce(false), 600);
      prevStreakRef.current = currentStreak;
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak]);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }

    if (popoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [popoverOpen]);

  // Position popover above button
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        setWidgetPosition({
          bottom: windowHeight - rect.top + 16,
          right: windowWidth - (rect.left + rect.width / 2),
        });
      }
    };

    if (popoverOpen) {
      setTimeout(updatePosition, 10);
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [popoverOpen]);

  // Progress toward next milestone
  const progressToNext =
    nextMilestoneAt !== null
      ? Math.min(100, Math.round((currentStreak / nextMilestoneAt) * 100))
      : 100;
  const daysToNext =
    nextMilestoneAt !== null ? nextMilestoneAt - currentStreak : 0;

  return (
    <>
      {/* Floating Popover */}
      <AnimatePresence>
        {popoverOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50"
            style={{
              bottom: `${widgetPosition.bottom + 8}px`,
              right: `${widgetPosition.right - 100}px`,
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-4 min-w-[200px] border border-gray-100 relative">
              {/* Tail/Arrow */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-r border-b border-gray-100 transform rotate-45" />

              <div className="relative z-10 space-y-3">
                {/* Header */}
                <div className="text-center">
                  <span className="text-3xl leading-none">
                    {currentStreak > 0 ? "🔥" : "⭐"}
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {currentStreak}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {streakMode === "classic"
                      ? "dager på rad"
                      : "dager totalt"}
                  </p>
                </div>

                {/* Personal record (classic mode only) */}
                {streakMode === "classic" && longestStreak > 0 && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                    <span>🏆</span>
                    <span className="font-semibold">
                      Rekord: {longestStreak} dager
                    </span>
                  </div>
                )}

                {/* Progress to next star */}
                {nextMilestoneAt !== null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                      <span>Neste ⭐</span>
                      <span>
                        {currentStreak}/{nextMilestoneAt}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progressToNext}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                      {daysToNext}{" "}
                      {daysToNext === 1 ? "dag" : "dager"} til neste
                      stjerne
                    </p>
                  </div>
                )}

                {/* Stars earned */}
                {streakStars > 0 && (
                  <div className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-600 pt-1 border-t border-slate-100">
                    <span>
                      {Array.from({ length: Math.min(streakStars, 5) })
                        .map(() => "⭐")
                        .join("")}
                    </span>
                    {streakStars > 5 && (
                      <span className="text-slate-500">
                        +{streakStars - 5}
                      </span>
                    )}
                    <span className="text-slate-500 font-normal ml-1">
                      Nærværsstjerner
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak Button */}
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        title="Nærværsstjerner"
        animate={
          bounce
            ? {
                scale: [1, 1.25, 0.9, 1.1, 1],
                rotate: [0, -6, 6, -3, 0],
              }
            : { scale: 1 }
        }
        transition={
          bounce ? { duration: 0.55, ease: "easeOut" } : { duration: 0.2 }
        }
        className={`relative flex items-center justify-center flex-shrink-0 h-12 gap-1 px-3 rounded-full border transition-all duration-300 hover:scale-105 active:scale-95 ${
          popoverOpen
            ? "ring-2 ring-amber-400 border-amber-200 bg-amber-50"
            : currentStreak > 0
              ? "border-amber-200 bg-amber-50 shadow-sm"
              : "border-gray-200 bg-white shadow-sm"
        }`}
      >
        <span className="text-lg leading-none select-none">
          {currentStreak > 0 ? "🔥" : "⭐"}
        </span>
        <span
          className={`text-sm font-bold leading-none ${
            currentStreak > 0 ? "text-amber-700" : "text-slate-400"
          }`}
        >
          {currentStreak}
        </span>
      </motion.button>
    </>
  );
}
