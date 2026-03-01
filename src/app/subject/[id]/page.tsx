"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import CompletionModal from "@/components/CompletionModal";
import LevelUpModal from "@/components/LevelUpModal";
import HalfwayModal from "@/components/HalfwayModal";
import SubjectProgress from "@/components/student/SubjectProgress";
import StudentQuizView from "@/components/student/StudentQuizView";
import { ArrowLeft, Archive, X, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import { useTaskFlow } from "@/hooks/useTaskFlow";
import { getSubjectTheme } from "@/utils/subject-colors";
import { getHeroGradient } from "@/utils/hero-gradients";
import MediaUploadToolbar from "@/components/ui/MediaUploadToolbar";
import type { StudentTask, Subject as SharedSubject } from "@/types/shared";

type Task = StudentTask;
type Subject = SharedSubject;

export default function SubjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = useMemo(() => (params?.id as string) || "", [params]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isStackPulsing, setIsStackPulsing] = useState(false);
  const prevCompletedCount = useRef(completedTasks.length);

  const {
    profile,
    undoTask,
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
      const completedTask = tasks.find((t) => t.id === taskId);
      if (completedTask) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setCompletedTasks((prev) => [
          { ...completedTask, is_completed: true },
          ...prev,
        ]);
      }
    },
    showToast,
  });

  // Ensure we start at the top when opening a subject (avoids mid-scroll render)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [subjectId]);

  // Trigger stack pulse animation when a task is completed (count increases)
  useEffect(() => {
    if (completedTasks.length > prevCompletedCount.current) {
      setIsStackPulsing(true);
      const timer = setTimeout(() => setIsStackPulsing(false), 300);
      return () => clearTimeout(timer);
    }
    prevCompletedCount.current = completedTasks.length;
  }, [completedTasks.length]);

  // Fetch data on mount
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

      // Fetch subject details
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", subjectId)
        .single();

      if (subjectError) {
        // Silent – subject stays null
      } else {
        setSubject(subjectData);
      }

      // Fetch incomplete tasks for this subject (scoped to current student)
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("student_id", user.id)
        .eq("is_completed", false)
        .order("created_at", { ascending: true });

      if (tasksError) {
        // Silent – tasks stay empty
      } else {
        setTasks(tasksData || []);
      }

      // Fetch completed tasks for this subject (scoped to current student, with feedback + teacher profile)
      const { data: completedTasksData, error: completedError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          feedback (
            teacher_reaction,
            teacher_comment,
            read_at,
            teacher:profiles!feedback_teacher_id_fkey ( full_name, avatar_url )
          )
        `,
        )
        .eq("subject_id", subjectId)
        .eq("student_id", user.id)
        .eq("is_completed", true)
        .order("created_at", { ascending: false });

      if (completedError) {
        // Silent – completed list stays empty
      } else {
        const mapped = (completedTasksData || []).map((t: any) => {
          const fb = Array.isArray(t.feedback) ? t.feedback[0] : t.feedback;
          // Extract the teacher profile from the FK join
          // Supabase may return object, array-of-one, or null
          let teacherProfile = null;
          if (fb?.teacher) {
            teacherProfile = Array.isArray(fb.teacher)
              ? (fb.teacher[0] ?? null)
              : fb.teacher;
          }
          return {
            ...t,
            feedback: fb
              ? {
                  teacher_reaction: fb.teacher_reaction ?? null,
                  teacher_comment: fb.teacher_comment ?? null,
                  read_at: fb.read_at ?? null,
                  teacher: teacherProfile,
                }
              : null,
          };
        });
        setCompletedTasks(mapped);
      }

      setLoading(false);
    };

    if (subjectId) {
      fetchData();
    }
  }, [subjectId]);

  const handleUndoTask = async (taskId: string) => {
    const success = await undoTask(taskId);
    if (success) {
      // Move task from completed to active list
      const task = completedTasks.find((t) => t.id === taskId);
      if (task) {
        setCompletedTasks((prev) => prev.filter((t) => t.id !== taskId));
        setTasks((prev) => [...prev, { ...task, is_completed: false }]);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-indigo-400 animate-pulse font-medium text-lg">
            Laster oppgaver...
          </div>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Fant ikke faget.</p>
          <button
            onClick={() => router.push("/")}
            className="text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Tilbake til hjemme
          </button>
        </div>
      </div>
    );
  }

  const totalTasks = tasks.length + completedTasks.length;
  const completedCount = completedTasks.length;

  return (
    <main className="bg-gradient-to-b from-gray-50 to-white pb-32">
      <div className="max-w-5xl mx-auto w-full px-4 space-y-4">
        {/* Hero Section */}
        <section className="pb-2 pt-3">
          <div
            className="w-full text-center rounded-3xl shadow-sm px-4 py-5 md:py-6 flex flex-col items-center relative"
            style={{ background: getHeroGradient(subject.color_theme) }}
          >
            {/* Archive Button - Top Right */}
            {completedCount > 0 && (
              <motion.button
                onClick={() => setIsArchiveOpen(true)}
                className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer border-2 border-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
                title="Se fullførte oppgaver"
                animate={
                  isStackPulsing ? { scale: [1, 1.25, 1] } : { scale: 1 }
                }
                transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
              >
                <Archive className="h-5 w-5 text-gray-600" />
                <span className="font-bold text-sm text-gray-700">Ferdig</span>

                {/* Counter Badge */}
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {completedCount}
                </span>
              </motion.button>
            )}

            {/* Subject Icon (Boss) */}
            <div className="flex justify-center mb-2 md:mb-3">
              <div className="text-6xl md:text-6xl drop-shadow-md animate-bounce-settle">
                {subject.emoji}
              </div>
            </div>

            {/* Subject Title */}
            <h1
              className={`text-3xl font-extrabold tracking-tight md:text-4xl mb-2 ${
                getSubjectTheme(subject.color_theme || "gray").text
              }`}
            >
              {subject.title}
            </h1>

            {/* Progress Pill */}
            <SubjectProgress
              completed={completedCount}
              total={totalTasks}
              colorTheme={subject.color_theme}
            />
          </div>
        </section>

        {/* Archive Modal */}
        {isArchiveOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setIsArchiveOpen(false)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <Archive className="h-6 w-6 text-indigo-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Fullførte oppdrag
                  </h2>
                  <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-1 rounded-full">
                    {completedCount}
                  </span>
                </div>
                <button
                  onClick={() => setIsArchiveOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {completedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <Archive className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Ingen fullførte oppgaver ennå.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              {task.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {task.description}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                                ✓ Fullført
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {task.points_value} poeng
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUndoTask(task.id)}
                            className="flex-shrink-0 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-amber-200"
                          >
                            <Undo2 className="h-4 w-4" />
                            Angre
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tasks Grid */}
        <section className="w-full">
          <div className="w-full bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center w-full max-w-md md:max-w-lg mx-auto bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm p-6 mb-32">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Gratulerer!
                </h2>
                <p className="text-gray-600 mb-6">
                  Du har fullført alle oppgavene i dette faget.
                </p>
                <div className="w-full flex flex-col gap-3">
                  <button
                    onClick={() => router.push("/")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Tilbake til hjemme
                  </button>
                  {completedTasks.length > 0 && (
                    <button
                      onClick={() => setIsArchiveOpen(true)}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold py-3 px-6 rounded-xl transition-colors border border-amber-200"
                    >
                      📂 Se utførte oppgaver
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {tasks.map((task) => (
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
                        colorTheme={subject?.color_theme}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
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
        incompleteTasks={tasks}
        subjectContext={subject ? { id: subject.id, title: subject.title } : undefined}
      />
      <Toast toast={toast} onClose={hideToast} />
    </main>
  );
}
