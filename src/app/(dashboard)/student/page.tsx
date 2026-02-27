"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import ScheduleCard from "@/components/student/ScheduleCard";
import type {
  ScheduleEntry,
  LessonState,
} from "@/components/student/ScheduleCard";
import { getISOWeekNumber, getISODayOfWeek } from "@/utils/week-number";

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
    new Map(),
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
        const weekNumber = getISOWeekNumber(currentTime);

        // Call RPC function to get schedule
        const { data: scheduleData, error } = await supabase.rpc(
          "get_student_schedule",
          {
            p_student_id: user.id,
            p_current_week_number: weekNumber,
          },
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
          const todayNum = getISODayOfWeek(currentTime);

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
          const firstUpcoming = schedule.find((entry) => {
            const state = getLessonState(entry.start_time, entry.end_time);
            return state === "upcoming";
          });

          if (firstUpcoming) {
            const element = document.querySelector(
              `[data-id="${firstUpcoming.id}"]`,
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

  // Determine lesson state (uses reactive currentTime for consistency)
  const getLessonState = (startTime: string, endTime: string): LessonState => {
    const now = currentTime;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startDate = new Date(now);
    startDate.setHours(startHour, startMin, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(endHour, endMin, 0, 0);

    if (now < startDate) return "upcoming";
    if (now >= startDate && now < endDate) return "active";
    return "finished";
  };

  const getLessonProgressPercent = (
    startTime: string,
    endTime: string,
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

    const now = currentTime;

    const dayStart = new Date(now);
    dayStart.setHours(firstStart[0], firstStart[1], 0, 0);

    const dayEnd = new Date(now);
    dayEnd.setHours(lastEnd[0], lastEnd[1], 0, 0);

    if (now < dayStart) return 0;
    if (now > dayEnd) return 100;

    const progress = Math.min(
      100,
      Math.max(
        0,
        ((now.getTime() - dayStart.getTime()) /
          (dayEnd.getTime() - dayStart.getTime())) *
          100,
      ),
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
                    entry.end_time,
                  ) as LessonState;
                  const isLiveLesson = state === "active";
                  const distance = cardDistances.get(entry.id) || 999;
                  const isCentered = distance < 100;
                  const lessonProgress = getLessonProgressPercent(
                    entry.start_time,
                    entry.end_time,
                  );

                  return (
                    <ScheduleCard
                      key={entry.id}
                      entry={entry}
                      state={state}
                      isCentered={isCentered}
                      index={index}
                      onClick={() => handleLessonClick(entry, state)}
                      lessonProgress={lessonProgress}
                      activeRef={isLiveLesson ? activeLessonRef : undefined}
                    />
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
