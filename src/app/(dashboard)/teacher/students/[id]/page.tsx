"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import WeeklyScheduleEditor from "@/components/teacher/WeeklyScheduleEditor";
import TaskCreatorModal from "@/components/teacher/CreateTaskModal";
import { getSubjectTheme } from "@/utils/subject-colors";
import {
  ArrowLeft,
  Star,
  Flower,
  CheckCircle,
  Clock,
  Calendar,
  Gift,
  Edit,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  X,
  FileQuestion,
} from "lucide-react";

type StudentProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  class_id: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  due_date: string;
  is_completed: boolean;
  subject: string;
  type?: "standard" | "quiz";
};

type QuizQuestion = {
  id: string;
  text: string;
  answerType: "text" | "radio" | "checkbox";
  options: string[];
};

type Reward = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"todo" | "completed" | "timeplan">(
    "todo",
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [flowerGameEnabled, setFlowerGameEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [rewardModalView, setRewardModalView] = useState<"list" | "create">(
    "list",
  );
  const [newRewardForm, setNewRewardForm] = useState({ title: "", emoji: "" });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedRewards, setSelectedRewards] = useState<string[]>([]);
  const [studentRewards, setStudentRewards] = useState<Reward[]>([]);
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studentProfileData, setStudentProfileData] = useState<{
    current_xp: number;
    current_goal_total: number;
    points_earned: number;
    flowers_collected: number;
  }>({
    current_xp: 0,
    current_goal_total: 1000,
    points_earned: 0,
    flowers_collected: 0,
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    subject_id: "",
    points_value: 50,
    due_date: "",
    type: "standard" as "standard" | "quiz",
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchStudent();
    fetchStudentRewards();
    fetchTasks();
    fetchStudentProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Fetch available rewards when reward modal opens
  useEffect(() => {
    if (isRewardModalOpen) {
      fetchAvailableRewards();
      // Pre-select rewards that are already assigned to student
      setSelectedRewards(studentRewards.map((r) => r.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRewardModalOpen]);

  const fetchStudentRewards = async () => {
    try {
      // Fetch rewards assigned to this specific student (array contains studentId)
      const { data, error } = await supabase
        .from("rewards")
        .select("id, name:title, emoji, cost:cost_value")
        .contains("specific_student_ids", [studentId]);

      if (error) throw error;
      setStudentRewards(data || []);
    } catch (error) {
      console.error("Error fetching student rewards:", error);
    }
  };

  const fetchAvailableRewards = async () => {
    try {
      // Fetch rewards that are either:
      // 1. Available to all students (specific_student_ids is empty array)
      // 2. Already assigned to this student (array contains studentId)
      const { data, error } = await supabase
        .from("rewards")
        .select("id, name:title, emoji, cost:cost_value")
        .or(`specific_student_ids.eq.{},specific_student_ids.cs.{${studentId}}`)
        .order("title");

      if (error) throw error;
      setAvailableRewards(data || []);
    } catch (error) {
      console.error("Error fetching available rewards:", error);
    }
  };

  const fetchStudent = async () => {
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select(
          `
          *,
          profiles!inner (
            full_name,
            avatar_url,
            role
          ),
          classes (
            name
          )
        `,
        )
        .eq("id", studentId)
        .single();

      if (error) throw error;

      // Map the joined data to our StudentProfile type
      const studentData: StudentProfile = {
        id: data.id,
        full_name: data.profiles.full_name,
        avatar_url: data.profiles.avatar_url,
        level: data.level,
        class_name: data.classes?.name || null,
        class_id: data.class_id || null,
      };

      setStudent(studentData);
      setSelectedClass(studentData.class_name || "");
      setWelcomeMessage(data.custom_welcome_message || "");
    } catch (error) {
      console.error(
        "Error fetching student:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          points_value,
          due_date,
          is_completed,
          type,
          subject:subjects(title)
        `,
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedTasks: Task[] =
        data?.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          points_value: task.points_value,
          due_date: task.due_date,
          is_completed: task.is_completed,
          type: task.type,
          subject: task.subject?.title || "Ukjent",
        })) || [];

      setTasks(mappedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchStudentProfileData = async () => {
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select(
          "current_xp, current_goal_total, points_earned, flowers_collected",
        )
        .eq("id", studentId)
        .single();

      if (error) throw error;

      if (data) {
        setStudentProfileData({
          current_xp: data.current_xp || 0,
          current_goal_total: data.current_goal_total || 1000,
          points_earned: data.points_earned || 0,
          flowers_collected: data.flowers_collected || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching student profile data:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "I dag";
    if (date.toDateString() === tomorrow.toDateString()) return "I morgen";

    return date.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
    });
  };

  const getSubjectColor = (subject: string) => {
    const theme = getSubjectTheme(subject);
    return `${theme.light} ${theme.text}`;
  };

  const handleRemoveReward = async (rewardId: string) => {
    try {
      // Remove this student from the reward's specific_student_ids array
      const { data: reward } = await supabase
        .from("rewards")
        .select("specific_student_ids")
        .eq("id", rewardId)
        .single();

      const updatedIds = (reward?.specific_student_ids || []).filter(
        (id: string) => id !== studentId
      );

      const { error } = await supabase
        .from("rewards")
        .update({ specific_student_ids: updatedIds })
        .eq("id", rewardId);

      if (error) throw error;

      // Refresh the student rewards list
      await fetchStudentRewards();
    } catch (error) {
      console.error("Error removing reward:", error);
      alert("Kunne ikke fjerne belønning. Prøv igjen.");
    }
  };

  const handleSaveWelcomeMessage = async () => {
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ custom_welcome_message: welcomeMessage })
        .eq("id", studentId);

      if (error) throw error;

      alert("Velkomstmelding lagret!");
    } catch (error) {
      console.error("Error saving welcome message:", error);
      alert("Kunne ikke lagre velkomstmelding. Prøv igjen.");
    }
  };

  const handleAddReward = async () => {
    try {
      // Determine which rewards to add and which to remove
      const currentRewardIds = studentRewards.map((r) => r.id);
      const rewardsToAdd = selectedRewards.filter(
        (id) => !currentRewardIds.includes(id),
      );
      const rewardsToRemove = currentRewardIds.filter(
        (id) => !selectedRewards.includes(id),
      );

      // Add student to each reward's specific_student_ids array
      for (const rewardId of rewardsToAdd) {
        const { data: reward } = await supabase
          .from("rewards")
          .select("specific_student_ids")
          .eq("id", rewardId)
          .single();

        const currentIds: string[] = reward?.specific_student_ids || [];
        if (!currentIds.includes(studentId)) {
          const { error } = await supabase
            .from("rewards")
            .update({ specific_student_ids: [...currentIds, studentId] })
            .eq("id", rewardId);
          if (error) throw error;
        }
      }

      // Remove student from each reward's specific_student_ids array
      for (const rewardId of rewardsToRemove) {
        const { data: reward } = await supabase
          .from("rewards")
          .select("specific_student_ids")
          .eq("id", rewardId)
          .single();

        const updatedIds = (reward?.specific_student_ids || []).filter(
          (id: string) => id !== studentId
        );
        const { error } = await supabase
          .from("rewards")
          .update({ specific_student_ids: updatedIds })
          .eq("id", rewardId);
        if (error) throw error;
      }

      // Refresh the student rewards list
      await fetchStudentRewards();

      setIsRewardModalOpen(false);
      setSelectedRewards([]);
      setRewardModalView("list");
    } catch (error) {
      console.error("Error updating rewards:", error);
      alert("Kunne ikke oppdatere belønninger. Prøv igjen.");
    }
  };

  const handleCreateReward = async () => {
    if (!newRewardForm.title.trim()) {
      alert("Vennligst skriv inn en tittel");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Insert new reward with specific_student_ids containing current student
      const { data, error } = await supabase
        .from("rewards")
        .insert({
          title: newRewardForm.title.trim(),
          emoji: newRewardForm.emoji.trim() || "🎁", // Use default if no emoji selected
          created_by: user.id,
          specific_student_ids: [studentId],
          cost_type: "level",
          cost_value: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh both the student rewards list and available rewards list
      await fetchStudentRewards();
      await fetchAvailableRewards();

      // Add the newly created reward to selected rewards so it appears checked
      if (data?.id) {
        setSelectedRewards((prev) => [...prev, data.id]);
      }

      // Reset form and switch back to list view
      setNewRewardForm({ title: "", emoji: "" });
      setShowEmojiPicker(false);
      setRewardModalView("list");
    } catch (error) {
      console.error("Error creating reward:", error);
      alert("Kunne ikke opprette belønning. Prøv igjen.");
    }
  };

  const handleDeleteReward = async (rewardId: string) => {
    if (
      !confirm(
        "Er du sikker på at du vil slette denne belønningen permanent? Dette vil også fjerne den fra elever som har mottatt den.",
      )
    ) {
      return;
    }

    try {
      // Delete the reward - CASCADE will automatically delete related student_rewards
      const { error: rewardError } = await supabase
        .from("rewards")
        .delete()
        .eq("id", rewardId);

      if (rewardError) throw rewardError;

      // Remove from selectedRewards if it was selected
      setSelectedRewards((prev) => prev.filter((id) => id !== rewardId));

      // Refresh both lists
      await fetchStudentRewards();
      await fetchAvailableRewards();
    } catch (error) {
      console.error("Error deleting reward:", error);
      alert("Kunne ikke slette belønning. Prøv igjen.");
    }
  };

  const toggleRewardSelection = (rewardId: string) => {
    setSelectedRewards((prev) =>
      prev.includes(rewardId)
        ? prev.filter((id) => id !== rewardId)
        : [...prev, rewardId],
    );
  };

  const handleTaskCreated = async () => {
    // Refresh tasks list after task creation
    // For now, we just close the modal. In the future, this could fetch updated tasks
    // or receive the created task data to add to the local state
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      subject_id: "", // This should be populated from the database if you have subject_id stored
      points_value: task.points_value,
      due_date: task.due_date,
      type: task.type as "standard" | "quiz",
    });
    setIsEditTaskModalOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!editingTaskId || !taskForm.title.trim()) {
      alert("Vennligst skriv inn en tittel");
      return;
    }

    if (!taskForm.subject_id) {
      alert("Vennligst velg et fag");
      return;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: taskForm.title,
          description: taskForm.description,
          points_value: taskForm.points_value,
          due_date: taskForm.due_date || null,
          type: taskForm.type,
          quiz_data: taskForm.type === "quiz" ? quizQuestions : null,
        })
        .eq("id", editingTaskId);

      if (error) throw error;

      // Update task in state
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId
            ? {
                ...t,
                title: taskForm.title,
                description: taskForm.description,
                points_value: taskForm.points_value,
                due_date: taskForm.due_date,
                type: taskForm.type,
              }
            : t,
        ),
      );

      // Reset and close modal
      setEditingTaskId(null);
      setTaskForm({
        title: "",
        description: "",
        subject_id: "",
        points_value: 50,
        due_date: "",
        type: "standard",
      });
      setQuizQuestions([]);
      setIsEditTaskModalOpen(false);

      alert("Oppgave oppdatert!");
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Kunne ikke oppdatere oppgave. Prøv igjen.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne oppgaven?")) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert("Oppgave slettet!");
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Kunne ikke slette oppgave. Prøv igjen.");
    }
  };

  const todoTasks = tasks.filter((task) => !task.is_completed);
  const completedTasks = tasks.filter((task) => task.is_completed);

  const xpPercentage =
    (studentProfileData.current_xp / studentProfileData.current_goal_total) *
    100;

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600">Laster elevdata...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-slate-600 mb-4">Finner ikke eleven</p>
            <button
              onClick={() => router.push("/teacher/classes")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Tilbake til Mine Klasser
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Back Button & Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/teacher/classes")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Tilbake</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Administrer Elev</h1>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Innstillinger & Preferanser
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-900 block mb-1">
                  🔔 Push-varsler
                </label>
                <p className="text-xs text-slate-600">
                  Varsle lærer ved levering
                </p>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  notificationsEnabled ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Flower Game Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-900 block mb-1">
                  🌸 Blomster-spill
                </label>
                <p className="text-xs text-slate-600">Tilgang til minispill</p>
              </div>
              <button
                onClick={() => setFlowerGameEnabled(!flowerGameEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  flowerGameEnabled ? "bg-green-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flowerGameEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="text-sm font-medium text-slate-900 block mb-2">
                Velkomstmelding
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Skriv en personlig melding..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
              />
              <button
                onClick={handleSaveWelcomeMessage}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Lagre melding
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Profile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">
              Profil & Klasse
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Avatar & Name */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xl flex-shrink-0">
                {student.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.avatar_url}
                    alt={student.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  student.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">
                  {student.full_name}
                </h4>
              </div>
            </div>

            {/* Class Selection */}
            <div>
              <label className="text-sm font-medium text-slate-900 block mb-2">
                Klasse
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="">Ingen klasse</option>
                <option value="3B">3B</option>
                <option value="5A">5A</option>
                <option value="8A">8A</option>
                <option value="10. Trinn">10. Trinn</option>
              </select>
            </div>

            {/* Reset Password */}
            <button className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Nullstill passord
            </button>
          </div>
        </div>

        {/* Card 3: Stats & Reward */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">
              Nivå & Valuta
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Level Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Nivå</span>
              <span className="px-3 py-1 text-sm font-bold text-indigo-700 bg-indigo-100 rounded-full">
                {student.level}
              </span>
            </div>

            {/* XP Progress */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span>Erfaring</span>
                <span className="font-semibold">
                  {studentProfileData.current_xp}/
                  {studentProfileData.current_goal_total} XP
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${xpPercentage}%` }}
                />
              </div>
            </div>

            {/* Points */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600 fill-yellow-600" />
                <span className="text-sm font-medium text-slate-700">
                  Poeng
                </span>
              </div>
              <span className="text-lg font-bold text-yellow-700">
                {studentProfileData.points_earned}
              </span>
            </div>

            {/* Flowers */}
            <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Flower className="h-5 w-5 text-pink-600" />
                <span className="text-sm font-medium text-slate-700">
                  Blomster
                </span>
              </div>
              <span className="text-lg font-bold text-pink-700">
                {studentProfileData.flowers_collected}
              </span>
            </div>

            {/* Give Reward Button */}
            <button className="w-full px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all flex items-center justify-center gap-2">
              <Gift className="h-4 w-4" />
              Gi Belønning
            </button>
          </div>
        </div>

        {/* Card 4: Reward Options (Level-Up Selection) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Belønningsvalg
            </h3>
            <button
              onClick={() => setIsRewardModalOpen(true)}
              className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Legg til valg
            </button>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {studentRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{reward.emoji}</span>
                    <span className="text-sm font-medium text-slate-700">
                      {reward.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveReward(reward.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Fjern fra valg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 5: Tasks (Full Width) */}
        <div className="md:col-span-2 lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Aktive Gjøremål
            </h3>
            <button
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Ny Oppgave
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("todo")}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === "todo"
                    ? "text-indigo-600 bg-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Gjøremål</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                    {todoTasks.length}
                  </span>
                </div>
                {activeTab === "todo" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === "completed"
                    ? "text-green-600 bg-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Fullført</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                    {completedTasks.length}
                  </span>
                </div>
                {activeTab === "completed" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("timeplan")}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === "timeplan"
                    ? "text-purple-600 bg-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Timeplan</span>
                </div>
                {activeTab === "timeplan" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                )}
              </button>
            </div>
          </div>

          {/* Task List & Timeplan */}
          <div className="p-6">
            {activeTab === "todo" &&
              (todoTasks.length > 0 ? (
                <div className="space-y-3">
                  {todoTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded ${getSubjectColor(
                                task.subject,
                              )}`}
                            >
                              {task.subject}
                            </span>
                            {task.type === "quiz" && (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                                <FileQuestion className="h-3 w-3" />
                                Quiz
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-amber-600">
                              <Star className="h-4 w-4 fill-amber-600" />
                              <span className="text-sm font-semibold">
                                +{task.points_value}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-semibold text-slate-900 mb-1">
                            {task.title}
                          </h4>
                          <p className="text-sm text-slate-600 mb-3">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Frist: {formatDate(task.due_date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Rediger oppgave"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Slett oppgave"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Ingen aktive oppgaver</p>
                </div>
              ))}

            {activeTab === "completed" &&
              (completedTasks.length > 0 ? (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded ${getSubjectColor(
                                task.subject,
                              )}`}
                            >
                              {task.subject}
                            </span>
                            {task.type === "quiz" && (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                                <FileQuestion className="h-3 w-3" />
                                Quiz
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-amber-600">
                              <Star className="h-4 w-4 fill-amber-600" />
                              <span className="text-sm font-semibold">
                                +{task.points_value}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-semibold text-slate-900 mb-1">
                            {task.title}
                          </h4>
                          <p className="text-sm text-slate-600 mb-3">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Fullført: {formatDate(task.due_date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Se detaljer"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    Ingen fullførte oppgaver ennå
                  </p>
                </div>
              ))}

            {activeTab === "timeplan" && student && (
              <WeeklyScheduleEditor
                classId={student.class_id || ""}
                studentId={student.id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Reward Assignment Modal */}
      {isRewardModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsRewardModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {rewardModalView === "create"
                  ? "Opprett ny belønning"
                  : `Legg til belønning for ${student?.full_name}`}
              </h2>
              <button
                onClick={() => {
                  setIsRewardModalOpen(false);
                  setRewardModalView("list");
                  setNewRewardForm({ title: "", emoji: "" });
                  setShowEmojiPicker(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {rewardModalView === "list" ? (
                <>
                  {/* Reward Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Velg belønninger fra bibliotek
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableRewards.map((reward) => {
                        const isSelected = selectedRewards.includes(reward.id);

                        return (
                          <div
                            key={reward.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                              isSelected
                                ? "bg-indigo-50 border-indigo-500"
                                : "bg-white border-slate-200 hover:border-indigo-300"
                            }`}
                          >
                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  toggleRewardSelection(reward.id)
                                }
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <span className="text-xl">{reward.emoji}</span>
                              <span className="text-sm font-medium text-slate-700 flex-1">
                                {reward.name}
                              </span>
                            </label>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReward(reward.id);
                              }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Slett belønning permanent"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-slate-500">
                        Eller
                      </span>
                    </div>
                  </div>

                  {/* Create New Reward Button */}
                  <button
                    onClick={() => setRewardModalView("create")}
                    className="w-full px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-5 w-5" />
                    Opprett ny belønning
                  </button>
                </>
              ) : (
                <>
                  {/* Create Reward Form */}
                  <div className="space-y-4">
                    {/* Title Field */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Tittel <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newRewardForm.title}
                        onChange={(e) =>
                          setNewRewardForm({
                            ...newRewardForm,
                            title: e.target.value,
                          })
                        }
                        placeholder="F.eks. Ekstra frikvarter"
                        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Emoji Field */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Ikon (Emoji){" "}
                        <span className="text-xs font-normal text-slate-500">
                          (valgfritt)
                        </span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-full px-4 py-3 text-4xl border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-3"
                        >
                          {newRewardForm.emoji || "😊"}
                          <span className="text-xs text-slate-500 font-normal">
                            Trykk for å velge
                          </span>
                        </button>

                        {/* Emoji Picker Popup */}
                        {showEmojiPicker && (
                          <div className="absolute z-10 mt-2 w-full bg-white border border-slate-300 rounded-lg shadow-lg p-2">
                            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto">
                              {[
                                "🎁",
                                "🍕",
                                "⏰",
                                "🎨",
                                "📱",
                                "🎵",
                                "⭐",
                                "🌟",
                                "✏️",
                                "📚",
                                "🏆",
                                "🎯",
                                "🎮",
                                "🍦",
                                "🍰",
                                "🎪",
                                "🎭",
                                "🎬",
                                "🎤",
                                "🎧",
                                "🎸",
                                "🎹",
                                "🎺",
                                "🎻",
                                "🏀",
                                "⚽",
                                "🏈",
                                "⚾",
                                "🎾",
                                "🏐",
                                "🏓",
                                "🥇",
                                "🥈",
                                "🥉",
                                "🏅",
                                "🎖️",
                                "🌈",
                                "🌸",
                                "🌺",
                                "🌻",
                                "🌼",
                                "🌷",
                                "🌹",
                                "💐",
                                "🎀",
                                "💝",
                                "💖",
                                "💫",
                                "✨",
                                "💡",
                                "🔥",
                                "⚡",
                                "🌙",
                                "☀️",
                                "🌤️",
                                "🎉",
                              ].map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setNewRewardForm({
                                      ...newRewardForm,
                                      emoji,
                                    });
                                    setShowEmojiPicker(false);
                                  }}
                                  className="text-xl p-1.5 hover:bg-indigo-50 rounded transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            {newRewardForm.emoji && (
                              <button
                                type="button"
                                onClick={() => {
                                  setNewRewardForm({
                                    ...newRewardForm,
                                    emoji: "",
                                  });
                                  setShowEmojiPicker(false);
                                }}
                                className="mt-1.5 w-full px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Fjern emoji
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Hvis ingen emoji velges, brukes standardikon (🎁)
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Merk:</strong> Denne belønningen vil kun være
                        tilgjengelig for {student?.full_name}.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              {rewardModalView === "list" ? (
                <>
                  <button
                    onClick={() => {
                      setIsRewardModalOpen(false);
                      setRewardModalView("list");
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handleAddReward}
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    Oppdater valg
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRewardModalView("list");
                      setNewRewardForm({ title: "", emoji: "" });
                      setShowEmojiPicker(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Tilbake
                  </button>
                  <button
                    onClick={handleCreateReward}
                    disabled={!newRewardForm.title.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Lagre
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <TaskCreatorModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onSuccess={handleTaskCreated}
        initialStudentId={studentId}
      />

      {/* Edit Task Modal */}
      {isEditTaskModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsEditTaskModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">
                Rediger Oppgave for {student?.full_name}
              </h2>
              <button
                onClick={() => setIsEditTaskModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Title Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tittel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  placeholder="F.eks. Gangetabellen 1-5"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Beskrivelse
                </label>
                <textarea
                  value={taskForm.description || ""}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  placeholder="Kort beskrivelse av oppgaven..."
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Poeng Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Poeng
                </label>
                <input
                  type="number"
                  value={taskForm.points_value}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      points_value: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="5"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Due Date Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Frist (valgfri)
                </label>
                <input
                  type="date"
                  value={taskForm.due_date || ""}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, due_date: e.target.value })
                  }
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setIsEditTaskModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleUpdateTask}
                disabled={!taskForm.title.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Lagre Endringer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
