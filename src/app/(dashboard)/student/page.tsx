"use client";

import WelcomeOverlay from "@/components/WelcomeOverlay";
import SubjectCard from "@/components/SubjectCard";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

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
  const [showWelcome, setShowWelcome] = useState(() => {
    // Initialize from localStorage to avoid hydration mismatch
    if (typeof window !== "undefined") {
      return !localStorage.getItem("welcomeSeen");
    }
    return false;
  });

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
    // ENDRING 1: Ny bakgrunn (en subtil gradient fra indigo til cyan)
    <main className="min-h-screen bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-cyan-100 font-sans text-gray-900 pb-20 relative overflow-hidden">
      {/* Dekorativ "blob" i bakgrunnen for ekstra dybde */}
      <div className="absolute top-[-20%] right-[-20%] w-[800px] h-[800px] rounded-full bg-purple-200/30 blur-3xl -z-10 pointer-events-none mix-blend-multiply" />

      {showWelcome && (
        <WelcomeOverlay
          initialVisible={true}
          onDismiss={() => {
            localStorage.setItem("welcomeSeen", "1");
            setShowWelcome(false);
          }}
        />
      )}

      {/* ENDRING 2: Økt padding (px-6) og max-bredde (max-w-5xl) for mer luft */}
      <div className="pt-24 px-8 pb-24 max-w-5xl mx-auto space-y-12">
        <header className="flex flex-col items-start px-2"></header>

        {/* --- FAG-KORTENE (GRID) --- */}
        <section>
          {loading ? (
            <div className="text-center py-20 text-indigo-400 animate-pulse font-medium">
              Laster fagene dine...
            </div>
          ) : (
            // ENDRING 4: Responsiv grid og mer mellomrom
            // 'sm:grid-cols-2' betyr 2 kort i bredden på små skjermer/nettbrett
            // 'lg:grid-cols-3' betyr 3 kort i bredden på større skjermer
            // 'gap-8' gir mye mer luft mellom kortene enn 'gap-5'
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10 place-items-stretch">
              {subjects.map((subject, index) => {
                const totalTasks = subject.tasks?.length || 0;
                const completedTasks =
                  subject.tasks?.filter((t) => t.is_completed).length || 0;

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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
