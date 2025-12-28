"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import TaskCard from "@/components/TaskCard";
import CompletionModal from "@/components/CompletionModal";
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

export default function SubjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch subject details
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", params.id)
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
        .eq("subject_id", params.id)
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

    fetchData();
  }, [params.id]);

  // Handle task completion
  const handleTaskComplete = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleConfirmCompletion = async () => {
    if (!selectedTask || !profile) return;

    const supabase = createClient();

    try {
      // 1. Mark task as completed
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ is_completed: true })
        .eq("id", selectedTask.id);

      if (taskError) throw taskError;

      // 2. Update user profile - increment points and flowers
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          points_earned: profile.points_earned + selectedTask.points_value,
          flowers_collected: profile.flowers_collected + 1,
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // 3. Update local state - remove completed task from list
      setTasks((prevTasks) =>
        prevTasks.filter((t) => t.id !== selectedTask.id)
      );

      // Update local profile state
      setProfile((prevProfile) =>
        prevProfile
          ? {
              ...prevProfile,
              points_earned:
                prevProfile.points_earned + selectedTask.points_value,
              flowers_collected: prevProfile.flowers_collected + 1,
            }
          : null
      );

      // Close modal
      setIsModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error("Feil ved fullføring av oppgave:", error);
      alert("Noe gikk galt. Prøv igjen.");
    }
  };

  // Map color theme to Tailwind classes
  const getHeaderColorClass = (theme: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-gradient-to-br from-blue-500 to-blue-600",
      green: "bg-gradient-to-br from-green-500 to-green-600",
      purple: "bg-gradient-to-br from-purple-500 to-purple-600",
      orange: "bg-gradient-to-br from-orange-500 to-orange-600",
      pink: "bg-gradient-to-br from-pink-500 to-pink-600",
      indigo: "bg-gradient-to-br from-indigo-500 to-indigo-600",
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
        )} text-white py-8 px-6 shadow-lg`}
      >
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Tilbake</span>
          </button>

          <div className="flex items-center gap-4">
            <span className="text-5xl">{subject.emoji}</span>
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                {subject.title}
              </h1>
              <p className="text-white/80 mt-1">
                {tasks.length} {tasks.length === 1 ? "oppgave" : "oppgaver"}{" "}
                igjen
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tasks Grid */}
      <div className="max-w-4xl mx-auto px-6 py-8">
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

      {/* Completion Modal */}
      <CompletionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        onConfirm={handleConfirmCompletion}
        avatar={profile?.current_avatar || "🦄"}
      />
    </main>
  );
}
