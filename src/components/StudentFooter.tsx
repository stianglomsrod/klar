"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import CircularProgress from "./ui/CircularProgress";
import StudentHelpButton from "./student/StudentHelpButton";
import FlowerPot from "./FlowerPot";

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
  // Help button props
  studentId?: string;
  classId?: string;
  /** Called when the student clicks their avatar to change it. */
  onAvatarClick?: () => void;
  // Flower teaser props
  showFlowerGarden?: boolean;
  petalsProgress?: number;
  petalColors?: string[];
  // Pending reward props
  pendingRewardCount?: number;
  onClaimReward?: () => void;
};

export default function StudentFooter({
  level = 3,
  progressPercent = 42,
  avatar = "🦄",
  timeTrackerEnabled = false,
  currentActivity,
  timeRemaining = "--",
  activityProgress = 0,
  studentId,
  classId,
  onAvatarClick,
  showFlowerGarden = false,
  petalsProgress = 0,
  petalColors = [],
  pendingRewardCount = 0,
  onClaimReward,
}: StudentFooterProps) {
  const [toolEnabled, setToolEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({
    bottom: 96,
    right: 32,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

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
        const distanceFromRight =
          windowWidth - (buttonRect.left + buttonRect.width / 2);

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
    window.addEventListener("resize", updatePosition);

    return () => window.removeEventListener("resize", updatePosition);
  }, [toolEnabled]);

  useEffect(() => {
    if (!classId) {
      setIsQueueOpen(false);
      return;
    }

    let isMounted = true;

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("is_queue_open")
        .eq("id", classId)
        .single();

      if (!error && data && isMounted) {
        setIsQueueOpen(Boolean(data.is_queue_open));
      }
    };

    fetchInitial();

    const channel = supabase
      .channel(`classes-queue-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classes",
          filter: `id=eq.${classId}`,
        },
        (payload) => {
          const next = (payload.new as { is_queue_open?: boolean })
            ?.is_queue_open;
          setIsQueueOpen(Boolean(next));
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [classId, supabase]);

  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  // Flower teaser: normalize colors with defaults
  const DEFAULT_PETAL_COLOR = "#E0E0E0";
  const teaserColors = useMemo(() => {
    const base =
      petalColors.length > 0 ? petalColors : Array(5).fill(DEFAULT_PETAL_COLOR);
    return [...base, ...Array(5).fill(DEFAULT_PETAL_COLOR)].slice(0, 5);
  }, [petalColors]);
  const teaserFilled = Math.max(0, Math.min(5, petalsProgress));

  // Track petal changes for bounce animation
  const [teaserBounce, setTeaserBounce] = useState(false);
  const prevPetalsRef = useRef(petalsProgress);
  useEffect(() => {
    if (petalsProgress !== prevPetalsRef.current && petalsProgress > 0) {
      setTeaserBounce(true);
      const timer = setTimeout(() => setTeaserBounce(false), 600);
      prevPetalsRef.current = petalsProgress;
      return () => clearTimeout(timer);
    }
    prevPetalsRef.current = petalsProgress;
  }, [petalsProgress]);

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
      <div className="bg-white/85 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
              {/* Light Background Track with gentle outline and inset highlight */}
              <div className="absolute inset-0 bg-slate-200 rounded-full overflow-hidden ring-1 ring-slate-300/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                {/* Bright Green Progress Fill with enhanced glow */}
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,197,94,0.4),0_4px_10px_-6px_rgba(16,185,129,0.5)]"
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
                <button
                  type="button"
                  onClick={onAvatarClick}
                  className="relative group cursor-pointer"
                  aria-label="Bytt avatar"
                >
                  {avatar && avatar.startsWith("http") ? (
                    // Avatar is a URL (image)
                    <img
                      src={avatar}
                      alt="User avatar"
                      className="w-7 h-7 rounded-full border-2 border-white shadow-md object-cover group-hover:ring-2 group-hover:ring-indigo-400 transition-all"
                    />
                  ) : (
                    // Avatar is an emoji
                    <span className="text-2xl filter drop-shadow-md transform -translate-y-1 block group-hover:scale-125 transition-transform">
                      {avatar}
                    </span>
                  )}
                </button>
              </motion.div>
            </div>
          </div>

          {/* Flower Teaser — mini garden link */}
          {showFlowerGarden && (
            <Link
              href="/belonninger/hage"
              className="relative flex items-center justify-center flex-shrink-0"
              title="Min blomsterhage"
            >
              <motion.div
                animate={
                  teaserBounce
                    ? {
                        scale: [1, 1.25, 0.9, 1.1, 1],
                        rotate: [0, -6, 6, -3, 0],
                      }
                    : { scale: 1 }
                }
                transition={
                  teaserBounce
                    ? { duration: 0.55, ease: "easeOut" }
                    : { duration: 0.2 }
                }
                className="relative"
              >
                <FlowerPot
                  petalsFilled={teaserFilled}
                  colors={teaserColors}
                  size={44}
                  isInteractive={false}
                />
                {/* Subtle petal count ring */}
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-[2px]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-[5px] h-[5px] rounded-full transition-colors duration-300 ${
                        i < teaserFilled
                          ? "bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.6)]"
                          : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            </Link>
          )}

          {/* Pending Reward Gift Indicator */}
          {pendingRewardCount > 0 && (
            <motion.button
              type="button"
              onClick={onClaimReward}
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
              aria-label={`Du har ${pendingRewardCount} ${pendingRewardCount === 1 ? "premie" : "premier"} å hente`}
            >
              <span className="text-xl leading-none select-none">🎁</span>
              {pendingRewardCount > 1 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                  {pendingRewardCount}
                </span>
              )}
            </motion.button>
          )}

          {/* Time Tool Toggle Button */}
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

          {/* Help Button */}
          {studentId && classId && isQueueOpen && (
            <StudentHelpButton studentId={studentId} classId={classId} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
