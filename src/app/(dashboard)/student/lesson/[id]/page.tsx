"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import CompletionModal from "@/components/CompletionModal";
import LevelUpModal from "@/components/LevelUpModal";
import HalfwayModal from "@/components/HalfwayModal";
import SubjectProgress from "@/components/student/SubjectProgress";
import StudentQuizView from "@/components/student/StudentQuizView";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import { useTaskFlow } from "@/hooks/useTaskFlow";
import { getSubjectTheme } from "@/utils/subject-colors";
import { getHeroGradient } from "@/utils/hero-gradients";
import { formatTime } from "@/utils/format-time";
import MediaUploadToolbar from "@/components/ui/MediaUploadToolbar";
import type { StudentTask } from "@/types/shared";

// ── Types ────────────────────────────────────────────

type Task = StudentTask;

type ScheduleEntryMeta = {
  id: string;
  subject_id: string | null;
  subject_title: string;
  subject_emoji: string;
  subject_color: string;
  custom_title: string | null;
  start_time: string;
  end_time: string;
};

// ── Page Component ───────────────────────────────────

export default function LessonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleEntryId = useMemo(() => (params?.id as string) || "", [params]);

  // Schedule entry metadata
  const [meta, setMeta] = useState<ScheduleEntryMeta | null>(null);

  // Tasks: only those linked via task_schedule_entries
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { toast, showToast, hideToast } = useToast();

  const {
    profile,
    mediaToolbarRef,
    mediaImage,
    setMediaImage,
    mediaAudioBlob,
    mediaAudioUrl,
    handleAudioRecorded,
    handleAudioRemove,
    isModalOpen,
    showLevelUpModal,
    newLevel,
    isQuizOpen,
    quizTask,
    handleTaskComplete,
    handleConfirmCompletion,
    handleQuizSubmit,
    handleRewardSelection,
    handleBeforeConfirm,
    closeCompletionModal,
    closeQuiz,
    closeLevelUpModal,
    showHalfwayModal,
    closeHalfwayModal,
  } = useTaskFlow({
    tasks,
    onTaskCompleted: (taskId) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, is_completed: true } : t)),
      );
    },
    showToast,
  });

  // Scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [scheduleEntryId]);

  // ── Fetch schedule entry + linked tasks ──────────
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Authenticate current student
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        // 1. Fetch schedule entry with subject join
        const { data: entryData, error: entryError } = await supabase
          .from("schedule_entries")
          .select(
            "id, subject_id, custom_title, start_time, end_time, subjects ( title, emoji, color_theme )",
          )
          .eq("id", scheduleEntryId)
          .single();

        if (entryError || !entryData) {
          setErrorMsg("Timen ble ikke funnet.");
          setLoading(false);
          return;
        }

        // Extract subject info (Supabase may return object or array-of-one)
        const subjectJoin = Array.isArray(entryData.subjects)
          ? entryData.subjects[0]
          : entryData.subjects;

        const entryMeta: ScheduleEntryMeta = {
          id: entryData.id,
          subject_id: entryData.subject_id,
          subject_title: subjectJoin?.title ?? entryData.custom_title ?? "Time",
          subject_emoji: subjectJoin?.emoji ?? "📚",
          subject_color: subjectJoin?.color_theme ?? "gray",
          custom_title: entryData.custom_title,
          start_time:
            typeof entryData.start_time === "string"
              ? formatTime(entryData.start_time)
              : entryData.start_time,
          end_time:
            typeof entryData.end_time === "string"
              ? formatTime(entryData.end_time)
              : entryData.end_time,
        };
        setMeta(entryMeta);

        // 2. Fetch task IDs linked to this schedule entry
        const { data: junctionRows, error: junctionError } = await supabase
          .from("task_schedule_entries")
          .select("task_id")
          .eq("schedule_entry_id", scheduleEntryId);

        if (junctionError) {
          setTasks([]);
          setLoading(false);
          return;
        }

        const taskIds = (junctionRows || []).map(
          (r: { task_id: string }) => r.task_id,
        );

        if (taskIds.length === 0) {
          setTasks([]);
          setLoading(false);
          return;
        }

        // 3. Fetch full task rows (scoped to current student)
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select(
            "id, title, description, points_value, type, is_completed, quiz_data",
          )
          .in("id", taskIds)
          .eq("student_id", user.id)
          .order("created_at", { ascending: true });

        if (tasksError) {
          // Silent – tasks stay empty
        }

        setTasks(tasksData || []);
      } catch {
        setErrorMsg("En feil oppstod. Prøv igjen senere.");
      } finally {
        setLoading(false);
      }
    };

    if (scheduleEntryId) {
      fetchData();
    }
  }, [scheduleEntryId]);

  // ── Loading state ────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-indigo-400 animate-pulse font-medium text-lg">
          Laster time...
        </div>
      </div>
    );
  }

  if (errorMsg || !meta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {errorMsg || "Timen ble ikke funnet"}
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

  // ── Derived state ────────────────────────────────

  const theme = getSubjectTheme(meta.subject_color);
  const incompleteTasks = tasks.filter((t) => !t.is_completed);
  const completedCount = tasks.filter((t) => t.is_completed).length;
  const totalTasks = tasks.length;
  const subtitle = meta.custom_title
    ? `${meta.custom_title} · ${meta.start_time} – ${meta.end_time}`
    : `${meta.start_time} – ${meta.end_time}`;

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
            style={{ background: getHeroGradient(meta.subject_color) }}
          >
            {/* Subject Icon */}
            <div className="flex justify-center mb-2 md:mb-3">
              <div className="text-6xl drop-shadow-md animate-bounce-settle">
                {meta.subject_emoji}
              </div>
            </div>

            {/* Subject Title */}
            <h1
              className={`text-3xl font-extrabold tracking-tight md:text-4xl mb-2 ${theme.text}`}
            >
              {meta.subject_title}
            </h1>

            {/* Subtitle — time slot */}
            <p className="text-sm text-gray-600 font-medium mb-1">{subtitle}</p>

            {/* Progress Pill */}
            {totalTasks > 0 && (
              <SubjectProgress
                completed={completedCount}
                total={totalTasks}
                colorTheme={meta.subject_color}
              />
            )}
          </div>
        </section>

        {/* Tasks Grid */}
        <section className="w-full">
          <div className="w-full bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm">
            {incompleteTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center w-full max-w-md md:max-w-lg mx-auto bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm p-6 mb-32">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {totalTasks === 0
                    ? "Ingen oppgaver for denne timen"
                    : "Gratulerer!"}
                </h2>
                <p className="text-gray-600 mb-6">
                  {totalTasks === 0
                    ? "Slapp av og nyt timen!"
                    : "Du har fullført alle oppgavene for denne timen."}
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
                  {incompleteTasks.map((task) => (
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
                      <TaskCard
                        task={task}
                        onComplete={() => handleTaskComplete(task)}
                        colorTheme={meta.subject_color}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>

        {/* Link to full subject library (Container A) */}
        {meta.subject_id && (
          <section className="w-full flex justify-center pt-2">
            <Link
              href={`/subject/${meta.subject_id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Se alle {meta.subject_title}-oppgaver
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}
      </div>

      {/* Completion Modal */}
      <CompletionModal
        isOpen={isModalOpen}
        onClose={closeCompletionModal}
        onConfirm={handleConfirmCompletion}
        onBeforeConfirm={handleBeforeConfirm}
        avatarUrl={profile?.avatar_url}
      >
        <MediaUploadToolbar
          ref={mediaToolbarRef}
          onImageChange={setMediaImage}
          onAudioRecorded={handleAudioRecorded}
          onAudioRemove={handleAudioRemove}
          hasAudio={!!mediaAudioBlob}
          audioUrl={mediaAudioUrl}
          imageFile={mediaImage}
        />
      </CompletionModal>

      {/* Student Quiz View */}
      {quizTask && quizTask.quiz_data && (
        <StudentQuizView
          isOpen={isQuizOpen}
          questions={quizTask.quiz_data}
          taskTitle={quizTask.title}
          onClose={closeQuiz}
          onSubmit={handleQuizSubmit}
        />
      )}

      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUpModal}
        newLevel={newLevel}
        onClose={closeLevelUpModal}
        onSelectReward={handleRewardSelection}
        existingPetals={profile?.petals_progress || 0}
        existingColors={profile?.petal_colors || []}
        showFlowerGarden={profile?.show_flower_garden || false}
        studentId={profile?.id}
      />

      {/* Halfway Celebration Modal */}
      <HalfwayModal
        isOpen={showHalfwayModal}
        onClose={closeHalfwayModal}
        currentXp={profile?.current_xp ?? 0}
        goalTotal={profile?.current_goal_total ?? 100}
        level={profile?.current_level ?? 1}
        studentId={profile?.id ?? ""}
        showFlowerGarden={profile?.show_flower_garden ?? false}
        incompleteTasks={tasks.filter((t) => !t.is_completed)}
        subjectContext={
          meta
            ? { id: meta.subject_id ?? "", title: meta.subject_title }
            : undefined
        }
      />
      <Toast toast={toast} onClose={hideToast} />
    </main>
  );
}
