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

  // Ensure we start at the top when opening a subject (avoids mid-scroll render)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [subjectId]);

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

  const playSuccessSound = () => {
    const audio = new Audio("/sounds/pling.mp3");
    audio.volume = 0.5; // Not too loud
    audio
      .play()
      .catch((e) =>
        console.log("Audio play failed (user interaction needed first):", e)
      );
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

      // Play success sound
      playSuccessSound();

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
  // Map color theme to text colors for hero section
  const getColorClass = (theme: string) => {
    const colorMap: Record<string, string> = {
      blue: "text-blue-700",
      green: "text-green-700",
      purple: "text-purple-700",
      orange: "text-orange-700",
      pink: "text-pink-700",
      indigo: "text-indigo-700",
    };
    return colorMap[theme] || colorMap.blue;
  };

  // Map color theme to badge border colors
  const getBorderColorClass = (theme: string) => {
    const colorMap: Record<string, string> = {
      blue: "border-blue-300",
      green: "border-green-300",
      purple: "border-purple-300",
      orange: "border-orange-300",
      pink: "border-pink-300",
      indigo: "border-indigo-300",
    };
    return colorMap[theme] || colorMap.blue;
  };

  // Map color theme to gradient background for hero section
  const getGradientClass = (theme: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-gradient-to-b from-blue-200 via-blue-100 to-white",
      green: "bg-gradient-to-b from-green-200 via-green-100 to-white",
      purple: "bg-gradient-to-b from-purple-200 via-purple-100 to-white",
      orange: "bg-gradient-to-b from-orange-200 via-orange-100 to-white",
      pink: "bg-gradient-to-b from-pink-200 via-pink-100 to-white",
      indigo: "bg-gradient-to-b from-indigo-200 via-indigo-100 to-white",
    };
    return colorMap[theme] || colorMap.blue;
  };

  // Map color theme to fill/background colors for progress pill
  const getFillColorClass = (theme: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      pink: "bg-pink-500",
      indigo: "bg-indigo-500",
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

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const progressPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <main className="bg-gradient-to-b from-gray-50 to-white pb-32">
      <div className="max-w-5xl mx-auto w-full px-4 space-y-4">
        {/* Hero Section */}
        <section className="pb-2 pt-3">
          <div
            className={`w-full text-center rounded-3xl shadow-sm ${getGradientClass(
              subject.color_theme
            )} px-4 py-5 md:py-6 flex flex-col items-center`}
          >
            {/* Subject Icon (Boss) */}
            <div className="flex justify-center mb-2 md:mb-3">
              <div className="text-6xl md:text-6xl drop-shadow-md animate-bounce-settle">
                {subject.emoji}
              </div>
            </div>

            {/* Subject Title */}
            <h1
              className={`text-3xl font-extrabold tracking-tight md:text-4xl mb-2 ${getColorClass(
                subject.color_theme
              )}`}
            >
              {subject.title}
            </h1>

            {/* Progress Pill */}
            <div className="mt-2 w-32 h-6 bg-gray-200 rounded-full relative overflow-hidden shadow-inner">
              <div
                className={`absolute top-0 left-0 h-full ${getFillColorClass(
                  subject.color_theme
                )} transition-all duration-500 ease-out`}
                style={{ width: `${progressPercent}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 z-10">
                {completedTasks} / {totalTasks}
              </div>
            </div>
          </div>
        </section>

        {/* Tasks Grid */}
        <section className="w-full">
          <div className="w-full bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center w-full max-w-md md:max-w-lg mx-auto bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm p-6 mb-32">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Gratulerer!
                </h2>
                <p className="text-gray-600 mb-3">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task) => (
                  <div key={task.id} className="w-full h-full">
                    <TaskCard
                      task={task}
                      onComplete={() => handleTaskComplete(task)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

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
