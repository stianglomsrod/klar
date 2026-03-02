"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer } from "lucide-react";
import CircularProgress from "../ui/CircularProgress";

type Activity = {
  title: string;
  emoji: string;
  type: "lesson" | "break" | "free" | "upcoming";
  endTime: string | null;
};

type TimeTrackerWidgetProps = {
  currentActivity?: Activity;
  timeRemaining: string;
  activityProgress: number;
};

/** Get hex colour for current activity type */
function getActivityColor(activity?: Activity): string {
  if (!activity) return "#94a3b8"; // slate-400
  switch (activity.type) {
    case "lesson":
      return "#6366f1"; // indigo-500
    case "break":
      return "#22c55e"; // green-500
    case "upcoming":
      return "#f59e0b"; // amber-500
    case "free":
      return "#94a3b8"; // slate-400
    default:
      return "#94a3b8";
  }
}

export default function TimeTrackerWidget({
  currentActivity,
  timeRemaining,
  activityProgress,
}: TimeTrackerWidgetProps) {
  const [toolEnabled, setToolEnabled] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({
    bottom: 96,
    right: 32,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setToolEnabled(false);
      }
    }

    if (toolEnabled) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [toolEnabled]);

  // Calculate widget position based on button position
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        const distanceFromBottom = windowHeight - buttonRect.top + 16;
        const distanceFromRight =
          windowWidth - (buttonRect.left + buttonRect.width / 2);

        setWidgetPosition({
          bottom: distanceFromBottom,
          right: distanceFromRight,
        });
      }
    };

    if (toolEnabled) {
      setTimeout(updatePosition, 10);
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [toolEnabled]);

  const activityColor = getActivityColor(currentActivity);

  return (
    <>
      {/* Floating Popover */}
      <AnimatePresence>
        {toolEnabled && currentActivity && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50"
            style={{
              bottom: `${widgetPosition.bottom + 8}px`,
              right: `${widgetPosition.right - 84}px`,
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-4 min-w-[140px] border border-gray-100 relative">
              {/* Tail/Arrow */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-r border-b border-gray-100 transform rotate-45" />

              <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
                <div className="flex flex-row items-center justify-center gap-2">
                  <span className="text-lg leading-none">
                    {currentActivity.emoji}
                  </span>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide leading-none pb-[2px]">
                    {currentActivity.title}
                  </h3>
                </div>

                <div className="flex-shrink-0">
                  <CircularProgress
                    size={100}
                    strokeWidth={7}
                    percentage={activityProgress}
                    color={activityColor}
                    text={timeRemaining}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setToolEnabled((v) => !v)}
        title={toolEnabled ? "Skru av tidtaker" : "Skru på tidtaker"}
        className={`relative group flex items-center justify-center h-14 w-14 rounded-full border border-gray-100 bg-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-gray-50 active:scale-95 ${
          toolEnabled
            ? "ring-2 ring-indigo-400 text-indigo-600"
            : "text-gray-400"
        }`}
      >
        <Timer
          className="h-6 w-6 transition-transform duration-300"
          strokeWidth={2}
        />
      </button>
    </>
  );
}
