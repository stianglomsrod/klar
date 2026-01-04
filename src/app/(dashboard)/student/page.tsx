"use client";

import WelcomeOverlay from "@/components/WelcomeOverlay";
import ResponsiveArchive from "@/components/ResponsiveArchive";
import SubjectCard from "@/components/SubjectCard";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

// Definer typene vi får fra databasen
type Task = {
  id: string;
  is_completed: boolean;
};

type Subject = {
  id: string;
  title: string;
  emoji: string;
  color_theme: string;
  tasks: Task[];
};

export default function StudentPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
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

      // Fetch subjects with all tasks
      const { data: subjectsData, error: subjectsError } = await supabase.from(
        "subjects"
      ).select(`
          *,
          tasks (*)
        `);

      if (subjectsError) {
        console.error("Feil ved henting av fag:", subjectsError);
      } else {
        setSubjects(subjectsData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    // Professional high-contrast background
    <main className="min-h-screen bg-slate-50 font-sans text-gray-900 pb-20 relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100/50 via-transparent to-blue-50/30 -z-10 pointer-events-none" />

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
              activeTasks === 0 && completedTasks > 0
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
      <div className="pt-24 px-8 pb-24 max-w-5xl mx-auto space-y-12">
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
                    className="flex flex-col items-center justify-center text-center w-full max-w-md mx-auto bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-indigo-100 shadow-lg p-8"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10 place-items-stretch">
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
                          colorTheme={subject.color_theme}
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
