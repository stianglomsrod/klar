"use client";

import WelcomeOverlay from "@/components/WelcomeOverlay";
import ResponsiveArchive from "@/components/ResponsiveArchive";
import SubjectCard from "@/components/SubjectCard";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import type { SubjectWithTasks } from "@/types/shared";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  useEffect(() => {
    // Check localStorage after hydration to avoid mismatch
    const hasSeenWelcome = localStorage.getItem("welcomeSeen");
    setShowWelcome(!hasSeenWelcome);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Authenticate current student
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch subjects and this student's tasks in parallel
      const [subjectsRes, tasksRes] = await Promise.all([
        supabase.from("subjects").select("*"),
        supabase.from("tasks").select("*").eq("student_id", user.id),
      ]);

      if (subjectsRes.error || tasksRes.error) {
        // Silent — subjects load failure handled by empty state UI
      } else {
        // Group tasks by subject_id
        const tasksBySubject = new Map<string, typeof tasksRes.data>();
        for (const task of tasksRes.data ?? []) {
          const sid = task.subject_id;
          if (!sid) continue;
          if (!tasksBySubject.has(sid)) tasksBySubject.set(sid, []);
          tasksBySubject.get(sid)!.push(task);
        }

        // Merge tasks into subjects
        const merged: SubjectWithTasks[] = (subjectsRes.data ?? []).map(
          (subject) => ({
            ...subject,
            tasks: tasksBySubject.get(subject.id) ?? [],
          }),
        );
        setSubjects(merged);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    // Professional high-contrast background
    <main className="min-h-screen bg-[#F1F5F9] font-sans text-gray-900 pb-20 relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100/60 via-transparent to-blue-50/40 -z-10 pointer-events-none" />

      {showWelcome && (
        <WelcomeOverlay
          initialVisible={true}
          onDismiss={() => {
            localStorage.setItem("welcomeSeen", "1");
            setShowWelcome(false);
          }}
        />
      )}

      {/* Archive Drawer/Popover - Responsive */}
      <ResponsiveArchive
        isOpen={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        completedSubjects={subjects
          .map((subject) => {
            const activeTasks =
              subject.tasks?.filter((t) => !t.is_completed).length || 0;
            const completedTasks =
              subject.tasks?.filter((t) => t.is_completed).length || 0;
            return {
              subject,
              activeTasks,
              completedTasks,
            };
          })
          .filter(
            ({ activeTasks, completedTasks }) =>
              activeTasks === 0 && completedTasks > 0,
          )
          .map(({ subject }) => subject)}
        completedSubjectsCount={
          subjects.filter((subject) => {
            const activeTasks =
              subject.tasks?.filter((t) => !t.is_completed).length || 0;
            const completedTasks =
              subject.tasks?.filter((t) => t.is_completed).length || 0;
            return activeTasks === 0 && completedTasks > 0;
          }).length
        }
      />

      {/* Main Content */}
      <div className="pt-20 sm:pt-24 px-4 sm:px-6 lg:px-8 pb-24 max-w-5xl mx-auto space-y-8 sm:space-y-12">
        <header className="flex flex-col items-start px-2"></header>

        {/* --- FAG-KORTENE (GRID) --- */}
        <section>
          {loading ? (
            <div className="text-center py-20 text-indigo-400 animate-pulse font-medium">
              Laster fagene dine...
            </div>
          ) : (
            (() => {
              // Filter subjects into active only
              const activeSubjects = subjects.filter((subject) => {
                const activeTasks =
                  subject.tasks?.filter((t) => !t.is_completed).length || 0;
                return activeTasks > 0;
              });

              const hasCompletedSubjects = subjects.some((subject) => {
                const activeTasks =
                  subject.tasks?.filter((t) => !t.is_completed).length || 0;
                const completedTasks =
                  subject.tasks?.filter((t) => t.is_completed).length || 0;
                return activeTasks === 0 && completedTasks > 0;
              });

              // If no active subjects, show celebration view
              if (activeSubjects.length === 0) {
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center w-full max-w-md mx-auto bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-indigo-100 shadow-lg p-5 sm:p-8"
                  >
                    <div className="text-7xl mb-6 animate-bounce">🎉</div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                      Alt ferdig!
                    </h2>
                    <p className="text-slate-600 mb-6">
                      Du har fullført alle oppgavene dine. Flott jobbet!
                    </p>
                    {hasCompletedSubjects && (
                      <button
                        onClick={() => setIsArchiveOpen(true)}
                        className="text-indigo-600 hover:text-indigo-700 font-semibold underline"
                      >
                        Se arkivet ditt
                      </button>
                    )}
                  </motion.div>
                );
              }

              // Show active subjects in grid
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 pb-10 place-items-stretch">
                  <AnimatePresence mode="wait">
                    {activeSubjects.map((subject, index) => {
                      const totalTasks = subject.tasks?.length || 0;
                      const completedTasks =
                        subject.tasks?.filter((t) => t.is_completed).length ||
                        0;

                      return (
                        <SubjectCard
                          key={subject.id}
                          id={subject.id}
                          index={index}
                          title={subject.title}
                          emoji={subject.emoji}
                          colorTheme={subject.color_theme || "gray"}
                          taskCount={totalTasks}
                          completedCount={completedTasks}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })()
          )}
        </section>
      </div>

      {/* Floating Archive Button is now part of ResponsiveArchive component */}
    </main>
  );
}
