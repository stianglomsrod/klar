"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Loader2,
  ListTodo,
} from "lucide-react";
import WelcomeOverlay from "@/components/WelcomeOverlay";

type ScheduleEntry = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  subject_title: string;
  emoji: string;
  subject_color: string;
  entry_has_tasks: boolean;
  subject_has_tasks: boolean;
  custom_title: string | null;
  tasks_total: number;
  tasks_completed: number;
};

const colorVariants: Record<string, string> = {
  amber: "border-amber-500",
  blue: "border-blue-500",
  emerald: "border-emerald-500",
  gray: "border-gray-500",
  green: "border-green-500",
  indigo: "border-indigo-500",
  orange: "border-orange-500",
  pink: "border-pink-500",
  purple: "border-purple-500",
  red: "border-red-500",
  rose: "border-rose-500",
  teal: "border-teal-500",
  violet: "border-violet-500",
  yellow: "border-yellow-500",
  default: "border-gray-300",
};

const shadowRgbValues: Record<string, string> = {
  amber: "245, 158, 11",
  blue: "59, 130, 246",
  emerald: "16, 185, 129",
  gray: "107, 114, 128",
  green: "34, 197, 94",
  indigo: "99, 102, 241",
  orange: "249, 115, 22",
  pink: "236, 72, 153",
  purple: "168, 85, 247",
  red: "239, 68, 68",
  rose: "244, 63, 94",
  teal: "20, 184, 166",
  violet: "139, 92, 246",
  yellow: "234, 179, 8",
};

const LessonProgress = ({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) => {
  const size = 44;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="w-12 h-12 flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="-rotate-90 drop-shadow-sm"
        role="presentation"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

const MissionChip = ({
  completed,
  total,
  color,
  isActive,
}: {
  completed: number;
  total: number;
  color: string;
  isActive: boolean;
}) => {
  // Status-based color logic: Green if all tasks completed, Gray if incomplete
  const isAllTasksCompleted = completed >= total;

  // Determine colors based on completion status and active state
  const bgClass = isAllTasksCompleted
    ? isActive
      ? "bg-emerald-500"
      : "bg-emerald-100"
    : isActive
      ? "bg-gray-600"
      : "bg-gray-100";

  const textClass = isAllTasksCompleted
    ? isActive
      ? "text-white"
      : "text-emerald-700"
    : isActive
      ? "text-white"
      : "text-gray-600";

  return (
    <div
      className={`ml-3 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${bgClass} ${textClass} ${
        isActive ? "shadow-sm" : ""
      }`}
    >
      <ListTodo className="h-3.5 w-3.5" />
      <span>
        {completed}/{total}
      </span>
    </div>
  );
};

export default function StudentQuestLogPage() {
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState<string>("Elev");
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });

  // Refs for wheel navigation
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLessonRef = useRef<HTMLButtonElement>(null); // Current lesson based on time
  const [scrollPosition, setScrollPosition] = useState(0);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [cardDistances, setCardDistances] = useState<Map<string, number>>(
    new Map()
  );
  const [showWelcome, setShowWelcome] = useState(false);

  // Check localStorage for welcome overlay
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("welcomeSeen");
    setShowWelcome(!hasSeenWelcome);
  }, []);

  // Update current time every 30 seconds for smoother timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch student data and schedule
  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Get student profile for name
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setStudentName(profileData.full_name || "Elev");
        }

        // Get current week number
        const d = new Date(
          Date.UTC(
            currentTime.getFullYear(),
            currentTime.getMonth(),
            currentTime.getDate()
          )
        );
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNumber = Math.ceil(
          ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
        );

        // Call RPC function to get schedule
        const { data: scheduleData, error } = await supabase.rpc(
          "get_student_schedule",
          {
            p_student_id: user.id,
            p_current_week_number: weekNumber,
          }
        );

        if (error) {
          // Log the complete error object for debugging
          console.error("Raw RPC error:", error);
          console.error("Error keys:", Object.keys(error));
          console.error("Error toString:", error.toString());
          console.error("Full error details:", {
            message: error.message,
            code: error.code,
            hint: error.hint,
            details: error.details,
          });

          setToast({
            message:
              "Kunne ikke laste dagens oppgaver. Prøv å laste siden på nytt.",
            visible: true,
          });
          setSchedule([]);
          setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }));
          }, 3000);
        } else {
          // Filter to today's lessons only
          const today = currentTime.getDay();
          const todayNum = today === 0 ? 7 : today; // Convert Sunday from 0 to 7

          const todaysLessons = (scheduleData || [])
            .filter((entry: any) => entry.day_of_week === todayNum)
            .map((entry: any) => ({
              ...entry,
              // Ensure defaults for task counts (in case RPC returns null)
              tasks_total: entry.tasks_total ?? 0,
              tasks_completed: entry.tasks_completed ?? 0,
              subject_color: entry.subject_color ?? "gray",
            }));

          setSchedule(todaysLessons);
        }
      } catch (err) {
        console.error("Error in fetchData:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate card distances from center on scroll + track active lesson index
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    const cards = container.querySelectorAll("[data-card]");

    const distances = new Map<string, number>();
    let closestIndex = 0;
    let minDistance = Infinity;

    cards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const distance = Math.abs(centerY - cardCenterY);
      const cardId = card.getAttribute("data-id") || "";
      distances.set(cardId, distance);

      // Track which card is closest to center
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    setCardDistances(distances);
    setActiveLessonIndex(closestIndex);
    setScrollPosition(container.scrollTop);
  };

  // Auto-scroll to current lesson when schedule loads
  useEffect(() => {
    if (!loading && schedule.length > 0) {
      setTimeout(() => {
        // First try to scroll to active lesson
        if (activeLessonRef.current) {
          activeLessonRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } else {
          // If no active lesson, find first upcoming lesson
          const now = new Date();
          const firstUpcoming = schedule.find((entry) => {
            const state = getLessonState(entry.start_time, entry.end_time);
            return state === "upcoming";
          });

          if (firstUpcoming) {
            const element = document.querySelector(
              `[data-id="${firstUpcoming.id}"]`
            );
            element?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }
        // Calculate distances after scroll completes
        setTimeout(() => {
          requestAnimationFrame(handleScroll);
        }, 400);
      }, 300);
    }
  }, [loading, schedule]);

  // Attach scroll listener for fisheye effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      requestAnimationFrame(handleScroll);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    // Initial calculation
    handleScroll();

    return () => container.removeEventListener("scroll", onScroll);
  }, [schedule.length]);

  // Determine lesson state
  const getLessonState = (startTime: string, endTime: string) => {
    const now = new Date();
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startDate = new Date();
    startDate.setHours(startHour, startMin, 0, 0);

    const endDate = new Date();
    endDate.setHours(endHour, endMin, 0, 0);

    if (now < startDate) return "upcoming";
    if (now >= startDate && now < endDate) return "active";
    return "finished";
  };

  const getLessonProgressPercent = (
    startTime: string,
    endTime: string
  ): number => {
    const now = currentTime;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startDate = new Date(now);
    startDate.setHours(startHour, startMin, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(endHour, endMin, 0, 0);

    const total = endDate.getTime() - startDate.getTime();
    if (total <= 0) return 0;

    const elapsed = now.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  };

  // Calculate school day progress
  const getProgressPercent = () => {
    if (schedule.length === 0) return 0;

    // Assuming school starts at first lesson and ends at last lesson
    const firstStart = schedule[0].start_time.split(":").map(Number);
    const lastEnd = schedule[schedule.length - 1].end_time
      .split(":")
      .map(Number);

    const dayStart = new Date();
    dayStart.setHours(firstStart[0], firstStart[1], 0);

    const dayEnd = new Date();
    dayEnd.setHours(lastEnd[0], lastEnd[1], 0);

    const now = new Date();
    if (now < dayStart) return 0;
    if (now > dayEnd) return 100;

    const progress = Math.min(
      100,
      Math.max(
        0,
        ((now.getTime() - dayStart.getTime()) /
          (dayEnd.getTime() - dayStart.getTime())) *
          100
      )
    );
    return Math.round(progress);
  };

  const handleLessonClick = (entry: ScheduleEntry, state: string) => {
    // Navigate to lesson detail page to view tasks and lesson info
    router.push(`/student/lesson/${entry.id}`);
  };

  // Scroll navigation helpers - index-based navigation
  const scrollToNext = () => {
    const container = containerRef.current;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll("[data-card]"));
    const nextIndex = activeLessonIndex + 1;

    if (nextIndex < cards.length) {
      cards[nextIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const scrollToPrevious = () => {
    const container = containerRef.current;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll("[data-card]"));
    const prevIndex = activeLessonIndex - 1;

    if (prevIndex >= 0) {
      cards[prevIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const progressPercent = getProgressPercent();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 overflow-hidden">
      {showWelcome && (
        <WelcomeOverlay
          initialVisible={true}
          onDismiss={() => {
            localStorage.setItem("welcomeSeen", "1");
            setShowWelcome(false);
          }}
        />
      )}
      <style jsx>{`
        @keyframes subtle-float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .animate-float {
          animation: subtle-float 3s ease-in-out infinite;
        }
      `}</style>
      {/* Subtle Header */}
      <div className="absolute top-6 left-0 right-0 z-10 text-center">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Dagens timeplan
        </p>
      </div>

      {/* Wheel Container */}
      <div className="relative h-screen flex items-center justify-center pt-16 pb-24">
        {/* Navigation Arrows - Index-Based Visibility, Positioned Over Faded Cards */}
        <button
          onClick={scrollToPrevious}
          className={`absolute top-[12vh] left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
            activeLessonIndex > 0
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          aria-label="Previous lesson"
        >
          <ChevronUp className="w-8 h-8 text-gray-400 hover:text-gray-600 hover:scale-110 transition-all" />
        </button>

        <button
          onClick={scrollToNext}
          className={`absolute bottom-[20vh] left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
            activeLessonIndex < schedule.length - 1
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          aria-label="Next lesson"
        >
          <ChevronDown className="w-8 h-8 text-gray-400 hover:text-gray-600 hover:scale-110 transition-all" />
        </button>

        {/* Scrollable Wheel */}
        {schedule.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-indigo-100 shadow-lg p-12 max-w-md"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Ingen oppdrag i dag!
            </h2>
            <p className="text-slate-600">
              Nyt en dag fri fra oppdrag. Du har gjort det bra! 🌟
            </p>
          </motion.div>
        ) : (
          <div
            ref={containerRef}
            className="h-[60vh] w-full max-w-2xl overflow-y-auto snap-y snap-mandatory scrollbar-hide px-4"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            {/* Massive padding to allow first/last items to center */}
            <div className="py-[calc(50vh-100px)] space-y-8">
              <AnimatePresence>
                {schedule.map((entry, index) => {
                  const state = getLessonState(
                    entry.start_time,
                    entry.end_time
                  );
                  const hasQuests =
                    entry.entry_has_tasks || entry.subject_has_tasks;
                  const isLiveLesson = state === "active"; // Actual current lesson based on time
                  const isFinished = state === "finished";
                  const isUpcoming = state === "upcoming";

                  // Visual emphasis and color mapping
                  const distance = cardDistances.get(entry.id) || 999;
                  const isCentered = distance < 100;
                  const scale = isCentered ? 1.1 : 0.9;
                  const opacity = isCentered ? 1 : 0.5;
                  const blur = 0;

                  const borderColor =
                    colorVariants[entry.subject_color] || colorVariants.default;
                  const subjectColorKey = entry.subject_color || "gray";
                  const shadowRgb =
                    shadowRgbValues[subjectColorKey] || shadowRgbValues.gray;
                  const accentColor = `rgb(${shadowRgb})`;
                  const subjectTitle = entry.subject_title || "Time";
                  const secondaryLabel = entry.custom_title
                    ? entry.custom_title
                    : `${index + 1}. time`;
                  const lessonProgress = getLessonProgressPercent(
                    entry.start_time,
                    entry.end_time
                  );

                  const glowStyle = isLiveLesson
                    ? {
                        boxShadow: `0 20px 25px -5px rgba(${shadowRgb}, 0.4), 0 8px 10px -6px rgba(${shadowRgb}, 0.2)`,
                      }
                    : undefined;

                  return (
                    <motion.button
                      key={entry.id}
                      ref={isLiveLesson ? activeLessonRef : null}
                      data-card
                      data-id={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      onClick={() => handleLessonClick(entry, state)}
                      style={{
                        transform: `scale(${scale})`,
                        opacity: opacity,
                        filter: `blur(${blur}px)`,
                      }}
                      className={`group relative w-full text-left transition-all duration-300 ease-out snap-center cursor-pointer ${
                        isCentered ? "z-10" : "z-0"
                      } ${
                        !isCentered ? "hover:opacity-100 hover:scale-95" : ""
                      }`}
                    >
                      <div
                        style={glowStyle}
                        className={`relative flex items-center gap-4 p-6 rounded-3xl border-l-8 ${borderColor} transition-all duration-300 ${
                          isCentered
                            ? "bg-white shadow-2xl"
                            : isFinished
                              ? "bg-gray-200/60"
                              : "bg-white/70"
                        } ${isLiveLesson ? "animate-float" : ""}`}
                      >
                        {/* Left: Large Emoji */}
                        <div className="flex-shrink-0">
                          <span
                            className={`transition-all duration-300 ${
                              isCentered ? "text-6xl" : "text-3xl"
                            }`}
                          >
                            {entry.emoji}
                          </span>
                        </div>

                        {/* Middle: Subject Title + Time */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-0">
                            <h3
                              className={`font-bold leading-tight truncate transition-all duration-300 ${
                                isCentered
                                  ? "text-3xl text-slate-900"
                                  : "text-lg text-slate-700"
                              } ${isFinished ? "text-slate-500" : ""}`}
                            >
                              {subjectTitle}
                            </h3>
                            {entry.tasks_total > 0 && (
                              <MissionChip
                                completed={entry.tasks_completed}
                                total={entry.tasks_total}
                                color={entry.subject_color}
                                isActive={isCentered}
                              />
                            )}
                          </div>

                          <p className="text-sm text-slate-500 truncate">
                            {secondaryLabel}
                          </p>

                          <p className="text-xs text-slate-500 font-medium">
                            {entry.start_time} - {entry.end_time}
                          </p>
                        </div>

                        {/* Right: Status indicator */}
                        <div className="flex-shrink-0 flex items-center justify-center">
                          {isFinished ? (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm bg-green-50">
                              <CheckCircle2 className="w-7 h-7 text-green-500" />
                            </div>
                          ) : isLiveLesson ? (
                            <LessonProgress
                              progress={lessonProgress}
                              color={accentColor}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center opacity-70" />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%", scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: 20, x: "-50%", scale: 0.9 }}
            className="fixed bottom-20 left-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg font-semibold text-center max-w-xs"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
