"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import CompletionModal from "@/components/CompletionModal";
import LevelUpModal from "@/components/LevelUpModal";
import { ArrowLeft } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  type: string;
  is_completed: boolean;
};

type Subject = {
  id: string;
  title: string;
  emoji: string;
  color_theme: string;
};

type Profile = {
  id: string;
  level: number;
  points_earned: number;
  current_avatar: string;
  petals_progress: number;
  flowers_collected: number;
};

export default function SubjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = useMemo(() => (params?.id as string) || "", [params]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch subject details
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", subjectId)
        .single();

      if (subjectError) {
        console.error("Feil ved henting av fag:", subjectError);
      } else {
        setSubject(subjectData);
      }

      // Fetch incomplete tasks for this subject
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("is_completed", false)
        .order("created_at", { ascending: true });

      if (tasksError) {
        console.error("Feil ved henting av oppgaver:", tasksError);
      } else {
        setTasks(tasksData || []);
      }

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .limit(1)
        .single();

      if (profileError) {
        console.error("Feil ved henting av profil:", profileError);
      } else {
        setProfile(profileData);
      }

      setLoading(false);
    };

    if (subjectId) {
      fetchData();
    }
  }, [subjectId]);

  // Handle task completion
  const handleTaskComplete = (task: Task) => {
    setSelectedTaskId(task.id);
    setIsModalOpen(true);
  };

  const handleConfirmCompletion = async () => {
    if (!selectedTaskId || !profile) return;

    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    const supabase = createClient();

    try {
      // 1. Mark task as completed
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ is_completed: true })
        .eq("id", selectedTaskId);

      if (taskError) throw taskError;

      // 2. Calculate new points and check for level up
      const currentPoints = profile.points_earned;
      const totalPoints = currentPoints + task.points_value;
      const currentLevel = profile.level;
      const calculatedLevel = Math.floor(totalPoints / 100);

      // 3. Update user profile - increment points and flowers
      const profileUpdates: any = {
        points_earned: totalPoints,
        flowers_collected: profile.flowers_collected + 1,
      };

      // Check if user leveled up
      if (calculatedLevel > currentLevel) {
        profileUpdates.level = calculatedLevel;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // 4. Optimistic update: mark task completed locally so UI turns green
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId ? { ...t, is_completed: true } : t
        )
      );

      // Update local profile state
      setProfile((prevProfile) =>
        prevProfile
          ? {
              ...prevProfile,
              points_earned: totalPoints,
              flowers_collected: prevProfile.flowers_collected + 1,
              level:
                calculatedLevel > currentLevel
                  ? calculatedLevel
                  : prevProfile.level,
            }
          : null
      );

      // Close completion modal
      setIsModalOpen(false);
      setSelectedTaskId(null);

      // 5. Show level up modal if user leveled up
      if (calculatedLevel > currentLevel) {
        setNewLevel(calculatedLevel);
        setShowLevelUpModal(true);
      }
    } catch (error) {
      console.error("Feil ved fullføring av oppgave:", error);
      alert("Noe gikk galt. Prøv igjen.");
    }
  };

  // Handle reward selection from Level Up modal
  const handleRewardSelection = async (
    rewardType: "petal" | "uno" | "break",
    payload?: string,
    petalIndex?: number
  ) => {
    if (!profile) return;

    const supabase = createClient();

    try {
      if (rewardType === "petal" && payload) {
        // Prepare a fixed-length colors array of 5 slots
        const currentColors = profile.petal_colors || [];
        const normalizedColors = Array.from(
          { length: 5 },
          (_, i) => currentColors[i] || ""
        );
        const targetIndex =
          typeof petalIndex === "number" && petalIndex >= 0 && petalIndex < 5
            ? petalIndex
            : 0;

        // Place color at the chosen index
        normalizedColors[targetIndex] = payload;

        // Recalculate progress as count of non-empty colors
        const newPetalsProgress = normalizedColors.filter(
          (c) => c && c.trim().length > 0
        ).length;

        // Check if flower is complete (5 petals)
        const isFlowerComplete = newPetalsProgress >= 5;

        const profileUpdates: any = {
          petals_progress: isFlowerComplete ? 0 : newPetalsProgress,
          petal_colors: isFlowerComplete ? [] : normalizedColors,
        };

        if (isFlowerComplete) {
          profileUpdates.flowers_collected = profile.flowers_collected + 1;
        }

        // Update Supabase
        const { error } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", profile.id);

        if (error) throw error;

        // Update local state
        setProfile((prevProfile) =>
          prevProfile
            ? {
                ...prevProfile,
                petals_progress: profileUpdates.petals_progress,
                petal_colors: profileUpdates.petal_colors,
                flowers_collected: isFlowerComplete
                  ? prevProfile.flowers_collected + 1
                  : prevProfile.flowers_collected,
              }
            : null
        );

        // Play success sound (optional)
        try {
          const audio = new Audio("/sounds/success.mp3");
          audio.play().catch(() => {});
        } catch (e) {
          // Ignore audio errors
        }
      }

      // Close level up modal
      setShowLevelUpModal(false);
    } catch (error) {
      console.error("Feil ved valg av belønning:", error);
      alert("Noe gikk galt. Prøv igjen.");
    }
  };

  // Map color theme to Tailwind classes
  const getHeaderColorClass = (theme: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-gradient-to-r from-blue-700 to-blue-500",
      green: "bg-gradient-to-r from-green-700 to-green-500",
      purple: "bg-gradient-to-r from-purple-700 to-purple-500",
      orange: "bg-gradient-to-r from-orange-700 to-orange-500",
      pink: "bg-gradient-to-r from-pink-700 to-pink-500",
      indigo: "bg-gradient-to-r from-indigo-700 to-indigo-500",
    };
    return colorMap[theme] || colorMap.blue;
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white pb-32">
      {/* Header with subject info */}
      <header
        className={`${getHeaderColorClass(
          subject.color_theme
        )} text-white py-3 px-4 shadow-lg`}
      >
        <div className="w-full flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-full text-white/90 hover:text-white transition-colors"
              aria-label="Tilbake"
            >
              <ArrowLeft size={28} />
            </button>
            <span className="text-4xl">{subject.emoji}</span>
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              {subject.title}
            </h1>
          </div>

          <div className="inline-flex items-center bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium">
            {tasks.length} {tasks.length === 1 ? "oppgave" : "oppgaver"} igjen
          </div>
        </div>
      </header>

      {/* Tasks Grid */}
      <section className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Gratulerer!
              </h2>
              <p className="text-gray-600 mb-6">
                Du har fullført alle oppgavene i dette faget.
              </p>
              <button
                onClick={() => router.push("/")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Tilbake til hjemme
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => handleTaskComplete(task)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Completion Modal */}
      <CompletionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTaskId(null);
        }}
        onConfirm={handleConfirmCompletion}
      />

      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUpModal}
        newLevel={newLevel}
        onClose={() => setShowLevelUpModal(false)}
        onSelectReward={handleRewardSelection}
        existingPetals={profile?.petals_progress || 0}
        existingColors={profile?.petal_colors || []}
      />
    </main>
  );
}
