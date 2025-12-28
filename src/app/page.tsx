"use client";

import { createClient } from "@/utils/supabase/client";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import Sidebar from "@/components/Sidebar";
import SubjectCard from "@/components/SubjectCard";
import { useEffect, useState } from "react";

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

type Profile = {
  id: string;
  level: number;
  points_earned: number;
  current_avatar: string;
  petals_progress: number;
  flowers_collected: number;
};

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .limit(1)
        .single();

      if (profileError) {
        console.error("Feil ved henting av profil:", profileError);
        // Use default values if no profile exists
      } else {
        setProfile(profileData);
      }

      // Fetch subjects with all tasks
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select(`
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

  // Extract profile data with defaults
  const userLevel = profile?.level || 1;
  const progressPercent = profile?.petals_progress || 0;
  const userAvatar = profile?.current_avatar || "🦄";

  return (
    // ENDRING 1: Ny bakgrunn (en subtil gradient fra indigo til cyan)
    <main className="min-h-screen bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-cyan-100 font-sans text-gray-900 pb-20 relative overflow-hidden">
      {/* Dekorativ "blob" i bakgrunnen for ekstra dybde */}
      <div className="absolute top-[-20%] right-[-20%] w-[800px] h-[800px] rounded-full bg-purple-200/30 blur-3xl -z-10 pointer-events-none mix-blend-multiply" />

      <WelcomeOverlay />
      <Sidebar 
        level={userLevel}
        progressPercent={progressPercent}
        avatar={userAvatar}
      />

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
                const completedTasks = subject.tasks?.filter(t => t.is_completed).length || 0;
                
                return (
                  <SubjectCard
                    key={subject.id}
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
