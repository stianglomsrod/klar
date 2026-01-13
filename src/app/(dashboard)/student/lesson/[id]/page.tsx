"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { getSubjectTheme } from "@/utils/subject-colors";

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  is_completed: boolean;
  type: "standard" | "quiz";
};

type LessonDetail = {
  entry_id: string;
  subject_title: string;
  subject_emoji: string;
  subject_color: string;
  custom_title: string | null;
  start_time: string;
  end_time: string;
  tasks_total: number;
  tasks_completed: number;
  tasks: Task[];
};

export default function LessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = params.id as string;

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    const fetchLessonDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc(
          "get_lesson_details",
          { p_entry_id: id }
        );

        if (rpcError) {
          console.error("RPC error:", rpcError);
          setError("Kunne ikke laste timens detaljer. Prøv igjen senere.");
          return;
        }

        if (!data || data.length === 0) {
          setError("Timen ble ikke funnet.");
          return;
        }

        setLesson(data[0]);
      } catch (err) {
        console.error("Error fetching lesson details:", err);
        setError("En feil oppstod. Prøv igjen senere.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLessonDetails();
    }
  }, [id, supabase]);

  const handleCompleteTask = async (task: Task) => {
    try {
      const newCompletedState = !task.is_completed;

      const { error } = await supabase
        .from("tasks")
        .update({ is_completed: newCompletedState })
        .eq("id", task.id);

      if (error) throw error;

      // Refresh lesson details
      setLesson((prev) => {
        if (!prev) return null;
        const updatedTasks = prev.tasks.map((t) =>
          t.id === task.id ? { ...t, is_completed: newCompletedState } : t
        );
        return {
          ...prev,
          tasks: updatedTasks,
          tasks_completed: newCompletedState
            ? prev.tasks_completed + 1
            : prev.tasks_completed - 1,
        };
      });
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  // Get hero section gradient - builds inline CSS gradient from theme
  const getHeroGradient = (theme: string) => {
    // Map to CSS gradient colors
    const colorGradients: Record<string, string> = {
      // Theme names
      red: "linear-gradient(to bottom, rgb(254, 226, 226), rgb(254, 240, 240), white)",
      blue: "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)",
      orange:
        "linear-gradient(to bottom, rgb(254, 231, 207), rgb(254, 245, 230), white)",
      amber:
        "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
      yellow:
        "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)", // Same as amber
      green:
        "linear-gradient(to bottom, rgb(220, 251, 219), rgb(240, 253, 244), white)",
      purple:
        "linear-gradient(to bottom, rgb(243, 232, 255), rgb(250, 245, 255), white)",
      violet:
        "linear-gradient(to bottom, rgb(237, 235, 254), rgb(245, 243, 255), white)",
      rose: "linear-gradient(to bottom, rgb(255, 228, 230), rgb(255, 245, 247), white)",
      emerald:
        "linear-gradient(to bottom, rgb(209, 250, 229), rgb(240, 253, 250), white)",
      gray: "linear-gradient(to bottom, rgb(229, 231, 235), rgb(249, 250, 251), white)",
      indigo:
        "linear-gradient(to bottom, rgb(224, 231, 255), rgb(238, 242, 255), white)",
      teal: "linear-gradient(to bottom, rgb(204, 251, 241), rgb(240, 253, 250), white)",
      pink: "linear-gradient(to bottom, rgb(252, 231, 243), rgb(253, 242, 248), white)",
    };

    return (
      colorGradients[theme] ||
      "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-indigo-400 animate-pulse font-medium text-lg">
            Laster time...
          </div>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {error || "Timen ble ikke funnet"}
          </p>
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Tilbake
          </button>
        </div>
      </div>
    );
  }

  const theme = getSubjectTheme(lesson.subject_color);
  const totalTasks = lesson.tasks.length;
  const completedCount = lesson.tasks.filter((t) => t.is_completed).length;
  const progressPercent =
    totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  const subtitle = lesson.custom_title
    ? `${lesson.custom_title} • ${lesson.start_time} - ${lesson.end_time}`
    : `${lesson.start_time} - ${lesson.end_time}`;

  return (
    <main className="bg-gradient-to-b from-gray-50 to-white pb-32">
      <style jsx>{`
        @keyframes bounce-settle {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          20% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-15px);
          }
          40% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(0);
          }
          70% {
            transform: translateY(-5px);
          }
          80%,
          100% {
            transform: translateY(0);
          }
        }
        .animate-bounce-settle {
          animation: bounce-settle 1.5s ease-out forwards;
        }
      `}</style>

      <div className="max-w-5xl mx-auto w-full px-4 space-y-4">
        {/* Hero Section */}
        <section className="pb-2 pt-3">
          <div
            className="w-full text-center rounded-3xl shadow-sm px-4 py-5 md:py-6 flex flex-col items-center relative"
            style={{ background: getHeroGradient(lesson.subject_color) }}
          >
            {/* Subject Icon (Boss) */}
            <div className="flex justify-center mb-2 md:mb-3">
              <div className="text-6xl md:text-6xl drop-shadow-md animate-bounce-settle">
                {lesson.subject_emoji}
              </div>
            </div>

            {/* Subject Title */}
            <h1
              className={`text-3xl font-extrabold tracking-tight md:text-4xl mb-2 ${theme.text}`}
            >
              {lesson.subject_title}
            </h1>

            {/* Subtitle - Lesson info */}
            <p className="text-sm text-gray-600 font-medium mb-1">{subtitle}</p>

            {/* Progress Pill */}
            {totalTasks > 0 && (
              <div className="mt-2 w-32 h-6 bg-gray-200 rounded-full relative overflow-hidden shadow-inner">
                <div
                  className={`absolute top-0 left-0 h-full ${theme.progress} transition-all duration-500 ease-out`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 z-10">
                  {completedCount} / {totalTasks}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tasks Grid */}
        <section className="w-full">
          <div className="w-full bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm">
            {lesson.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center w-full max-w-md md:max-w-lg mx-auto bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm p-6 mb-32">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Ingen oppdrag i denne timen
                </h2>
                <p className="text-gray-600 mb-6">
                  Du kan slappy av og nyte timen!
                </p>
                <div className="w-full flex flex-col gap-3">
                  <button
                    onClick={() => router.back()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Tilbake
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {lesson.tasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{
                        opacity: 0,
                        scale: 0.5,
                        transition: { duration: 0.3 },
                      }}
                      className="w-full h-full"
                    >
                      {/* Task Card - Copied exact structure from Subject page */}
                      <div className="h-full bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 p-5 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3 flex-1">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                              {task.title}
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {task.description}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {task.type === "quiz" && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                                Quiz
                              </span>
                            )}
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                              {task.points_value} poeng
                            </span>
                          </div>
                        </div>

                        {task.is_completed ? (
                          <div className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 font-semibold">
                            Fullført! ✅
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCompleteTask(task)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-wide py-4 px-6 rounded-xl shadow-md border-b-4 active:translate-y-[1px] active:border-b-2 transition-all duration-150 flex items-center justify-center gap-2"
                            style={{
                              borderBottomColor: `currentColor`,
                              opacity: 0.9,
                            }}
                          >
                            <CheckCircle className="h-5 w-5" />
                            Fullfør
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
