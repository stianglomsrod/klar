"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronUp, ChevronDown, Loader2 } from "lucide-react";

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
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(true);
  const [cardDistances, setCardDistances] = useState<Map<string, number>>(
    new Map()
  );

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
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
            student_id: user.id,
            current_week_number: weekNumber,
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

          const todaysLessons = (scheduleData || []).filter(
            (entry: any) => entry.day_of_week === todayNum
          );

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

  // Calculate card distances from center on scroll + smart arrow visibility
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    const cards = container.querySelectorAll("[data-card]");

    const distances = new Map<string, number>();
    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const distance = Math.abs(centerY - cardCenterY);
      const cardId = card.getAttribute("data-id") || "";
      distances.set(cardId, distance);
    });

    setCardDistances(distances);

    // Smart arrow visibility logic
    const { scrollTop, scrollHeight, clientHeight } = container;
    setScrollPosition(scrollTop);
    setCanScrollUp(scrollTop > 10);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
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
    if (state === "finished") return; // Don't allow clicks on finished lessons

    if (entry.entry_has_tasks) {
      // Scenario A: Navigate to task list for this specific lesson
      router.push(`/student/oppgaver?scheduleEntryId=${entry.id}`);
    } else if (entry.subject_has_tasks) {
      // Scenario B: Navigate to subject tasks
      router.push(`/student/fag/${entry.subject_id}`);
    } else {
      // Scenario C: Show toast
      setToast({
        message: "Ingen oppdrag i denne timen – slapp av! 😎",
        visible: true,
      });
      setTimeout(() => setToast({ message: "", visible: false }), 3000);
    }
  };

  // Scroll navigation helpers - snap to next/previous card
  const scrollToNext = () => {
    const container = containerRef.current;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll("[data-card]"));
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    // Find the first card below center
    const nextCard = cards.find((card) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenterY = cardRect.top + cardRect.height / 2;
      return cardCenterY > centerY + 20; // Small threshold
    });

    if (nextCard) {
      nextCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const scrollToPrevious = () => {
    const container = containerRef.current;
    if (!container) return;

    const cards = Array.from(
      container.querySelectorAll("[data-card]")
    ).reverse();
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    // Find the first card above center
    const prevCard = cards.find((card) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenterY = cardRect.top + cardRect.height / 2;
      return cardCenterY < centerY - 20; // Small threshold
    });

    if (prevCard) {
      prevCard.scrollIntoView({ behavior: "smooth", block: "center" });
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
      {/* Subtle Header */}
      <div className="absolute top-6 left-0 right-0 z-10 text-center">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Dagens timeplan
        </p>
      </div>

      {/* Wheel Container */}
      <div className="relative h-screen flex items-center justify-center pt-16 pb-24">
        {/* Navigation Arrows - Smart Visibility */}
        <AnimatePresence>
          {canScrollUp && (
            <motion.button
              key="arrow-up"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={scrollToPrevious}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-20 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95"
              aria-label="Previous lesson"
            >
              <ChevronUp className="w-6 h-6 text-slate-700" />
            </motion.button>
          )}

          {canScrollDown && (
            <motion.button
              key="arrow-down"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={scrollToNext}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95"
              aria-label="Next lesson"
            >
              <ChevronDown className="w-6 h-6 text-slate-700" />
            </motion.button>
          )}
        </AnimatePresence>

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
                  const subjectTitle = entry.subject_title || "Time";
                  const secondaryLabel = entry.custom_title
                    ? entry.custom_title
                    : `${index + 1}. time`;

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
                      disabled={isFinished || !isCentered}
                      style={{
                        transform: `scale(${scale})`,
                        opacity: opacity,
                        filter: `blur(${blur}px)`,
                        pointerEvents: isCentered ? "auto" : "none",
                      }}
                      className={`group relative w-full text-left transition-all duration-300 ease-out snap-center ${
                        isCentered ? "z-10" : "z-0"
                      }`}
                    >
                      <div
                        className={`relative flex items-center gap-4 p-6 rounded-3xl border-l-8 ${borderColor} transition-all duration-300 ${
                          isCentered
                            ? "bg-white shadow-2xl"
                            : isFinished
                            ? "bg-gray-200/60"
                            : "bg-white/70"
                        } ${
                          isLiveLesson
                            ? "ring-4 ring-blue-400 ring-offset-2 ring-offset-slate-100"
                            : ""
                        }`}
                      >
                        {/* LIVE Badge - Always visible on current lesson */}
                        {isLiveLesson && (
                          <motion.div
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute -top-3 -right-3 z-20"
                          >
                            <div className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5">
                              <motion.span
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-2 h-2 bg-white rounded-full"
                              />
                              NÅ LIVE
                            </div>
                          </motion.div>
                        )}
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
                          <div className="flex items-center gap-2">
                            <h3
                              className={`font-bold leading-tight truncate transition-all duration-300 ${
                                isCentered
                                  ? "text-3xl text-slate-900"
                                  : "text-lg text-slate-700"
                              } ${isFinished ? "text-slate-500" : ""}`}
                            >
                              {subjectTitle}
                            </h3>
                          </div>

                          <p className="text-sm text-slate-500 truncate">
                            {secondaryLabel}
                          </p>

                          <p className="text-xs text-slate-500 font-medium">
                            {entry.start_time} - {entry.end_time}
                          </p>
                        </div>

                        {/* Right: Quest Icon (only on centered card) */}
                        {hasQuests && !isFinished && isCentered && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="flex-shrink-0"
                          >
                            <motion.div
                              animate={{ scale: [1, 1.15, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <div className="text-4xl">📜</div>
                            </motion.div>
                          </motion.div>
                        )}

                        {/* Finished checkmark icon */}
                        {isFinished && isCentered && (
                          <div className="flex-shrink-0">
                            <CheckCircle2 className="w-10 h-10 text-slate-400" />
                          </div>
                        )}
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
