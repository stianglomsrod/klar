"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import SubjectHero from "@/components/student/SubjectHero";
import TaskFlowModals from "@/components/student/TaskFlowModals";
import ArchiveModal, {
  ArchiveButton,
  useArchivePulse,
} from "@/components/student/ArchiveModal";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/useToast";
import { useTaskFlow } from "@/hooks/useTaskFlow";
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

  const isStackPulsing = useArchivePulse(completedTasks.length);

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
        <SubjectHero
          emoji={subject.emoji}
          title={subject.title}
          colorTheme={subject.color_theme}
          completedCount={completedCount}
          totalTasks={totalTasks}
        >
          <ArchiveButton
            completedCount={completedCount}
            isStackPulsing={isStackPulsing}
            onOpen={() => setIsArchiveOpen(true)}
          />
        </SubjectHero>

        <ArchiveModal
          isOpen={isArchiveOpen}
          onClose={() => setIsArchiveOpen(false)}
          completedTasks={completedTasks}
          onUndo={handleUndoTask}
        />

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

      {/* Task Flow Modal Stack */}
      <TaskFlowModals
        profile={profile}
        isModalOpen={isModalOpen}
        closeCompletionModal={closeCompletionModal}
        handleConfirmCompletion={handleConfirmCompletion}
        handleBeforeConfirm={handleBeforeConfirm}
        mediaToolbarRef={mediaToolbarRef}
        mediaImage={mediaImage}
        setMediaImage={setMediaImage}
        mediaAudioBlob={mediaAudioBlob}
        mediaAudioUrl={mediaAudioUrl}
        handleAudioRecorded={handleAudioRecorded}
        handleAudioRemove={handleAudioRemove}
        isQuizOpen={isQuizOpen}
        quizTask={quizTask}
        closeQuiz={closeQuiz}
        handleQuizSubmit={handleQuizSubmit}
        showLevelUpModal={showLevelUpModal}
        newLevel={newLevel}
        closeLevelUpModal={closeLevelUpModal}
        handleRewardSelection={handleRewardSelection}
        showHalfwayModal={showHalfwayModal}
        closeHalfwayModal={closeHalfwayModal}
        incompleteTasks={tasks}
        subjectContext={
          subject ? { id: subject.id, title: subject.title } : undefined
        }
        toast={toast}
        hideToast={hideToast}
      />
    </main>
  );
}
