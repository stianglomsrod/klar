"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer } from "lucide-react";
import CircularProgress from "./ui/CircularProgress";

type StudentFooterProps = {
  level?: number;
  progressPercent?: number; // 0 - 100
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
};

export default function StudentFooter({
  level = 3,
  progressPercent = 42,
  avatar = "🦄",
  timeTrackerEnabled = false,
  currentActivity,
  timeRemaining = "--",
  activityProgress = 0,
}: StudentFooterProps) {
  const [toolEnabled, setToolEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({ bottom: 96, right: 32 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Wait 1.2 seconds (overlay fadeout is 0.8s + 0.4s buffer)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  // Calculate widget position based on button position
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        // Position widget above button: distance from bottom to button top + spacing
        const distanceFromBottom = windowHeight - buttonRect.top + 16;
        const distanceFromRight = windowWidth - (buttonRect.left + buttonRect.width / 2);
        
        setWidgetPosition({
          bottom: distanceFromBottom,
          right: distanceFromRight,
        });
      }
    };

    // Update when widget is enabled
    if (toolEnabled) {
      // Small delay to ensure button is rendered
      setTimeout(updatePosition, 10);
    }
    
    updatePosition();

    // Update on resize
    window.addEventListener('resize', updatePosition);
    
    return () => window.removeEventListener('resize', updatePosition);
  }, [toolEnabled]);

  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  // Juster denne for å sentrere avataren nøyaktig på prosent-streken
  const avatarOffset = `calc(${safeProgress}% - 0.75rem)`;

  // Get activity color (hex value for CircularProgress)
  const getActivityColor = () => {
    if (!currentActivity) return "#94a3b8"; // slate-400
    switch (currentActivity.type) {
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
  };

  const activityColor = getActivityColor();

  // Get activity background color for badge
  const getActivityBgColor = () => {
    if (!currentActivity) return "bg-slate-100 text-slate-700";
    switch (currentActivity.type) {
      case "lesson":
        return "bg-indigo-100 text-indigo-700";
      case "break":
        return "bg-green-100 text-green-700";
      case "upcoming":
        return "bg-amber-100 text-amber-700";
      case "free":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed bottom-0 inset-x-0 z-40"
    >
      {/* Floating Time Tracker Popover */}
      <AnimatePresence>
        {toolEnabled && currentActivity && (
          <motion.div
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
            {/* Popover Card */}
            <div className="bg-white rounded-2xl shadow-2xl p-4 min-w-[140px] border border-gray-100 relative">
              {/* Tail/Arrow pointing to button */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-r border-b border-gray-100 transform rotate-45"></div>

              <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
                {/* Top: Subject Title + Emoji */}
                <div className="flex flex-row items-center justify-center gap-2">
                  <span className="text-lg leading-none">
                    {currentActivity.emoji}
                  </span>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide leading-none pb-[2px]">
                    {currentActivity.title}
                  </h3>
                </div>

                {/* Bottom: Circular Progress */}
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

      {/* Main Footer Bar */}
      <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
                {avatar && avatar.startsWith("http") ? (
                  // Avatar is a URL (image)
                  <img
                    src={avatar}
                    alt="User avatar"
                    className="w-7 h-7 rounded-full border-2 border-white shadow-md object-cover"
                  />
                ) : (
                  // Avatar is an emoji
                  <span className="text-2xl filter drop-shadow-md transform -translate-y-1 block">
                    {avatar}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Time Tool Toggle Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setToolEnabled((v) => !v)}
          title={toolEnabled ? "Skru av tidtaker" : "Skru på tidtaker"}
          className={`relative group flex items-center justify-center h-12 w-12 rounded-full border transition-all duration-300 ease-in-out ${
            toolEnabled || timeTrackerEnabled
              ? "bg-indigo-50 border-indigo-400 text-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
              : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-300"
          }`}
        >
          <Timer
            className={`h-6 w-6 transition-transform duration-300 ${
              toolEnabled || timeTrackerEnabled ? "scale-110" : "scale-100"
            }`}
            strokeWidth={toolEnabled || timeTrackerEnabled ? 2.5 : 2}
          />

          {/* Activity indicator dot */}
          {(toolEnabled || timeTrackerEnabled) && currentActivity && (
            <span
              className={`absolute top-0 right-0 h-3 w-3 ${
                currentActivity.type === "lesson"
                  ? "bg-indigo-500"
                  : currentActivity.type === "break"
                  ? "bg-green-500"
                  : currentActivity.type === "upcoming"
                  ? "bg-amber-500"
                  : "bg-slate-500"
              } border-2 border-white rounded-full shadow-sm animate-pulse`}
            />
          )}
        </button>
      </div>
      </div>
    </motion.div>
  );
}
