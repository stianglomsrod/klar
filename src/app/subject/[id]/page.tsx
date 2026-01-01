"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import CompletionModal from "@/components/CompletionModal";
import LevelUpModal from "@/components/LevelUpModal";
import { ArrowLeft, Archive, X, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
  highest_level_reached?: number;
};

export default function SubjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = useMemo(() => (params?.id as string) || "", [params]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isStackPulsing, setIsStackPulsing] = useState(false);
  const prevCompletedCount = useRef(completedTasks.length);

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

      // Fetch completed tasks for this subject
      const { data: completedTasksData, error: completedError } = await supabase
        .from("tasks")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("is_completed", true)
        .order("created_at", { ascending: false });

      if (completedError) {
        console.error(
          "Feil ved henting av fullførte oppgaver:",
          completedError
        );
      } else {
        setCompletedTasks(completedTasksData || []);
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
        // Initialize high water mark if missing (legacy data)
        if (
          profileData &&
          (profileData.highest_level_reached === null ||
            profileData.highest_level_reached === undefined)
        ) {
          // Use the current level as the baseline for highest_level_reached
          const baseline = profileData.level || 1;
          try {
            await supabase
              .from("profiles")
              .update({ highest_level_reached: baseline })
              .eq("id", profileData.id);
            profileData.highest_level_reached = baseline;
          } catch (e) {
            console.warn("Kunne ikke oppdatere highest_level_reached:", e);
            // Ensure it's set in local state even if DB update fails
            profileData.highest_level_reached = baseline;
          }
        }
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

  const handleUndoTask = async (taskId: string) => {
    const supabase = createClient();

    try {
      // 1. Fetch task to get points_value
      const { data: taskData, error: taskFetchError } = await supabase
        .from("tasks")
        .select("points_value")
        .eq("id", taskId)
        .single();

      if (taskFetchError || !taskData)
        throw taskFetchError || new Error("Task not found");

      // 2. Mark task as incomplete
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ is_completed: false })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // 3. Update profile: decrement points (NO change to highest_level_reached)
      if (profile) {
        const newPoints = Math.max(
          0,
          profile.points_earned - taskData.points_value
        );
        const newLevel = Math.floor(newPoints / 100);

        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            points_earned: newPoints,
            level: newLevel,
            // highest_level_reached is NOT updated - it stays at the peak
          })
          .eq("id", profile.id);

        if (profileError) throw profileError;

        // 4. Update local state
        setProfile((prevProfile) =>
          prevProfile
            ? {
                ...prevProfile,
                points_earned: newPoints,
                level: newLevel,
                // highest_level_reached remains unchanged
              }
            : null
        );
      }

      // 5. Move task from completed to active list
      const task = completedTasks.find((t) => t.id === taskId);
      if (task) {
        setCompletedTasks((prev) => prev.filter((t) => t.id !== taskId));
        setTasks((prev) => [...prev, { ...task, is_completed: false }]);
      }
    } catch (error) {
      console.error("Feil ved angring av oppgave:", error);
      alert("Noe gikk galt. Prøv igjen.");
    }
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

      // 2. Calculate new points and check for level up (against high water mark)
      const currentPoints = profile.points_earned;
      const totalPoints = currentPoints + task.points_value;
      const currentLevel = profile.level ?? 1;
      // Ensure highest_level_reached has a valid value - default to 1 if missing
      const highestLevelReached = profile.highest_level_reached ?? 1;
      const calculatedLevel = Math.floor(totalPoints / 100);

      // Determine if this is a new level record
      const isNewLevelRecord = calculatedLevel > highestLevelReached;

      console.log(
        `Level up check: currentLevel=${currentLevel}, highestLevelReached=${highestLevelReached}, calculatedLevel=${calculatedLevel}, isNewRecord=${isNewLevelRecord}`
      );

      // 3. Update user profile - increment points and flowers
      const profileUpdates: any = {
        points_earned: totalPoints,
        flowers_collected: profile.flowers_collected + 1,
        level: calculatedLevel, // ALWAYS update level to match calculated level based on points
      };

      // Check if user is breaking a NEW record (anti-exploit: check against highest_level_reached)
      if (isNewLevelRecord) {
        // New level record achieved!
        profileUpdates.highest_level_reached = calculatedLevel;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // CRITICAL: Fetch fresh profile from DB to ensure we have accurate points_earned and level
      const { data: freshProfile, error: freshError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profile.id)
        .single();

      if (freshError) {
        console.warn(
          "Could not fetch fresh profile, using optimistic values:",
          freshError
        );
      } else if (freshProfile) {
        console.log(
          `Fresh profile from DB: level=${freshProfile.level}, points_earned=${freshProfile.points_earned}, highest_level_reached=${freshProfile.highest_level_reached}`
        );
        // Use the fresh data from database - this is authoritative
        setProfile(freshProfile);
      }

      // 4. Optimistic update: move task from active to completed list
      const completedTask = tasks.find((t) => t.id === selectedTaskId);
      if (completedTask) {
        setTasks((prev) => prev.filter((t) => t.id !== selectedTaskId));
        setCompletedTasks((prev) => [
          { ...completedTask, is_completed: true },
          ...prev,
        ]);
      }

      // Play success sound
      playSuccessSound();

      // Close completion modal
      setIsModalOpen(false);
      setSelectedTaskId(null);

      // 5. Show level up modal - Check fresh profile data
      // If we got fresh data, use it; otherwise fall back to calculated values
      const finalProfile = freshProfile || profile;
      // Use nullish coalescing to handle 0 as a valid level (don't convert 0 to 1!)
      const freshHighestLevel = finalProfile.highest_level_reached ?? 1;
      const freshLevel = finalProfile.level ?? 1;
      const previousLevel = profile.level ?? 1;

      console.log(
        `Modal check: Previous level=${previousLevel}, Fresh level=${freshLevel}, Fresh highest=${freshHighestLevel}`
      );

      // The authoritative check: did the level in the database increase?
      const levelIncreased = freshLevel > previousLevel;

      // Only show the modal if this is a TRUE level increase from the fresh DB data
      if (levelIncreased) {
        console.log(`Showing level up modal for level ${freshLevel}`);
        setNewLevel(freshLevel);
        setShowLevelUpModal(true);
      } else {
        console.log(
          `No level increase. Previous: ${previousLevel}, Fresh: ${freshLevel}`
        );
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

  const totalTasks = tasks.length + completedTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent =
    totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  return (
    <main className="bg-gradient-to-b from-gray-50 to-white pb-32">
      <div className="max-w-5xl mx-auto w-full px-4 space-y-4">
        {/* Hero Section */}
        <section className="pb-2 pt-3">
          <div
            className={`w-full text-center rounded-3xl shadow-sm ${getGradientClass(
              subject.color_theme
            )} px-4 py-5 md:py-6 flex flex-col items-center relative`}
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
                {completedCount} / {totalTasks}
              </div>
            </div>
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
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4 hover:shadow-md transition-shadow"
                      >
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
