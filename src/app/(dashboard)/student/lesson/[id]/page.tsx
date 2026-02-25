"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import CompletionModal from "@/components/CompletionModal";
import LevelUpModal from "@/components/LevelUpModal";
import SubjectProgress from "@/components/student/SubjectProgress";
import StudentQuizView, {
  type QuizQuestion,
  type QuizResponses,
  type QuizAudioBlobs,
} from "@/components/student/StudentQuizView";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { getSubjectTheme } from "@/utils/subject-colors";
import { formatTime } from "@/utils/format-time";
import MediaUploadToolbar, {
  type MediaUploadToolbarHandle,
} from "@/components/ui/MediaUploadToolbar";
import { uploadStudentMedia } from "@/utils/supabase/storage";

// ── Types ────────────────────────────────────────────

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  type: string;
  is_completed: boolean;
  quiz_data?: QuizQuestion[] | null;
};

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

// ── Hero gradient helper ─────────────────────────────

const heroGradients: Record<string, string> = {
  red: "linear-gradient(to bottom, rgb(254, 226, 226), rgb(254, 240, 240), white)",
  blue: "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)",
  orange:
    "linear-gradient(to bottom, rgb(254, 231, 207), rgb(254, 245, 230), white)",
  amber:
    "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
  yellow:
    "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
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

const getHeroGradient = (theme: string) =>
  heroGradients[theme] ||
  "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)";

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

  // useTaskCompletion hook — XP, leveling, sound, profile
  const {
    profile,
    isCompleting,
    completeTask,
    undoTask,
    selectReward,
    playSuccessSound,
  } = useTaskCompletion();

  // Modals
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // Quiz
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizTask, setQuizTask] = useState<Task | null>(null);

  // Media toolbar (smart-stop chain)
  const mediaToolbarRef = useRef<MediaUploadToolbarHandle>(null);
  const [mediaImage, setMediaImage] = useState<File | null>(null);
  const [mediaAudioBlob, setMediaAudioBlob] = useState<Blob | null>(null);
  const [mediaAudioUrl, setMediaAudioUrl] = useState<string | undefined>(
    undefined,
  );

  const handleAudioRecorded = useCallback((blob: Blob) => {
    setMediaAudioBlob(blob);
    setMediaAudioUrl(URL.createObjectURL(blob));
  }, []);

  const handleAudioRemove = useCallback(() => {
    if (mediaAudioUrl) URL.revokeObjectURL(mediaAudioUrl);
    setMediaAudioBlob(null);
    setMediaAudioUrl(undefined);
  }, [mediaAudioUrl]);

  const clearMedia = useCallback(() => {
    setMediaImage(null);
    if (mediaAudioUrl) URL.revokeObjectURL(mediaAudioUrl);
    setMediaAudioBlob(null);
    setMediaAudioUrl(undefined);
  }, [mediaAudioUrl]);

  // Scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [scheduleEntryId]);

  // ── Fetch schedule entry + linked tasks ──────────
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

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
          console.error("Schedule entry fetch error:", entryError);
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
          console.error("Junction fetch error:", junctionError);
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

        // 3. Fetch full task rows
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select(
            "id, title, description, points_value, type, is_completed, quiz_data",
          )
          .in("id", taskIds)
          .order("created_at", { ascending: true });

        if (tasksError) {
          console.error("Tasks fetch error:", tasksError);
        }

        setTasks(tasksData || []);
      } catch (err) {
        console.error("Error in lesson fetchData:", err);
        setErrorMsg("En feil oppstod. Prøv igjen senere.");
      } finally {
        setLoading(false);
      }
    };

    if (scheduleEntryId) {
      fetchData();
    }
  }, [scheduleEntryId]);

  // ── Task completion (standard) ───────────────────
  const handleTaskComplete = (task: Task) => {
    if (task.type === "quiz" && task.quiz_data && task.quiz_data.length > 0) {
      setQuizTask(task);
      setIsQuizOpen(true);
    } else {
      setSelectedTaskId(task.id);
      setIsModalOpen(true);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!selectedTaskId || !profile) return;

    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    try {
      // 1. Upload media attachments (if any)
      if (mediaImage || mediaAudioBlob) {
        const supabase = createClient();
        let imageUrl: string | null = null;
        let audioUrl: string | null = null;

        if (mediaImage) {
          imageUrl = await uploadStudentMedia(
            mediaImage,
            profile.id,
            selectedTaskId,
            "image",
          );
        }
        if (mediaAudioBlob) {
          audioUrl = await uploadStudentMedia(
            mediaAudioBlob,
            profile.id,
            selectedTaskId,
            "audio",
          );
        }

        await supabase.from("feedback").upsert(
          {
            task_id: selectedTaskId,
            student_id: profile.id,
            student_image_url: imageUrl,
            student_audio_url: audioUrl,
          },
          { onConflict: "task_id" },
        );
      }

      // 2. Complete task via hook
      const result = await completeTask(selectedTaskId, task.points_value);

      // 3. Optimistic UI update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId ? { ...t, is_completed: true } : t,
        ),
      );

      // 4. Close modal & clear media
      setIsModalOpen(false);
      setSelectedTaskId(null);
      clearMedia();

      // 5. Level up modal
      if (result?.shouldLevelUp && result.isNewHighLevel) {
        setNewLevel(result.newLevel);
        setShowLevelUpModal(true);
      }
    } catch (error) {
      console.error("Feil ved fullføring av oppgave:", error);
      alert("Noe gikk galt. Prøv igjen.");
    }
  };

  // ── Quiz submission ──────────────────────────────
  const handleQuizSubmit = async (
    responses: QuizResponses,
    audioBlobs: QuizAudioBlobs,
  ) => {
    if (!quizTask || !profile) return;

    const supabase = createClient();

    try {
      // 1. Upload per-question audio and build enriched payload
      const enrichedResponses: Record<
        string,
        { answer: string | string[]; audioUrl?: string }
      > = {};

      for (const [qId, answer] of Object.entries(responses)) {
        const entry: { answer: string | string[]; audioUrl?: string } = {
          answer,
        };

        if (audioBlobs[qId]) {
          const audioUrl = await uploadStudentMedia(
            audioBlobs[qId],
            profile.id,
            quizTask.id,
            "audio",
          );
          entry.audioUrl = audioUrl;
        }

        enrichedResponses[qId] = entry;
      }

      // Upload audio-only answers
      for (const [qId, blob] of Object.entries(audioBlobs)) {
        if (!enrichedResponses[qId]) {
          const audioUrl = await uploadStudentMedia(
            blob,
            profile.id,
            quizTask.id,
            "audio",
          );
          enrichedResponses[qId] = { answer: "", audioUrl };
        }
      }

      // 2. Upsert feedback with quiz_responses
      const { error: feedbackError } = await supabase.from("feedback").upsert(
        {
          task_id: quizTask.id,
          student_id: profile.id,
          quiz_responses: enrichedResponses,
        },
        { onConflict: "task_id" },
      );

      if (feedbackError) {
        console.error("Quiz feedback upsert error:", feedbackError);
        throw new Error(feedbackError.message || "Feedback upsert failed");
      }

      // 3. Complete task via hook
      const result = await completeTask(quizTask.id, quizTask.points_value);

      // 4. Optimistic UI update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === quizTask.id ? { ...t, is_completed: true } : t,
        ),
      );

      // 5. Close quiz
      setIsQuizOpen(false);
      setQuizTask(null);

      // 6. Level up modal
      if (result?.shouldLevelUp && result.isNewHighLevel) {
        setNewLevel(result.newLevel);
        setShowLevelUpModal(true);
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Feil ved lagring av quiz-svar:", msg);
      alert("Noe gikk galt ved lagring av svarene dine. Prøv igjen.");
    }
  };

  // ── Reward selection ─────────────────────────────
  const handleRewardSelection = async (
    rewardType: "petal" | "database",
    payload?: string,
    petalIndex?: number,
    rewardId?: string,
  ) => {
    const success = await selectReward(
      rewardType,
      payload,
      petalIndex,
      rewardId,
    );
    if (success) {
      setShowLevelUpModal(false);
    }
  };

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
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTaskId(null);
          clearMedia();
        }}
        onConfirm={handleConfirmCompletion}
        onBeforeConfirm={async () => {
          const blob = await mediaToolbarRef.current?.stopRecordingIfActive();
          if (blob) {
            await new Promise((r) => setTimeout(r, 50));
          }
        }}
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
          onClose={() => {
            setIsQuizOpen(false);
            setQuizTask(null);
          }}
          onSubmit={handleQuizSubmit}
        />
      )}

      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUpModal}
        newLevel={newLevel}
        onClose={() => setShowLevelUpModal(false)}
        onSelectReward={handleRewardSelection}
        existingPetals={profile?.petals_progress || 0}
        existingColors={profile?.petal_colors || []}
        showFlowerGarden={profile?.show_flower_garden || false}
        studentId={profile?.id}
      />
    </main>
  );
}
