"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isImageUrl } from "@/utils/avatar";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";
import WeeklyScheduleEditor from "@/components/teacher/WeeklyScheduleEditor";
import TaskCreatorModal, {
  type EditTaskData,
} from "@/components/teacher/CreateTaskModal";
import { recordStudentVisit } from "@/components/teacher/RecentStudents";
import { useTeacherProfile } from "@/hooks/useTeacherProfile";
import { getSubjectTheme } from "@/utils/subject-colors";
import StudentRewardManager from "@/components/teacher/StudentRewardManager";
import ClassCombobox from "@/components/teacher/ClassCombobox";
import StudentPasswordCard from "@/components/teacher/StudentPasswordCard";
import StudentSettingsCard from "@/components/teacher/StudentSettingsCard";
import {
  ArrowLeft,
  Star,
  Flower,
  CheckCircle,
  Clock,
  Calendar,
  Flame,
  Edit,
  Plus,
  Trash2,
  FileQuestion,
} from "lucide-react";

type StudentProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  class_id: string | null;
  custom_welcome_message: string;
  current_password_plaintext: string | null;
  streak_enabled: boolean;
  streak_mode: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  due_date: string;
  is_completed: boolean;
  subject: string;
  subject_id: string | null;
  type?: "standard" | "quiz";
  quiz_data?: any[] | null;
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { profile: teacherProfile } = useTeacherProfile();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(null);
  const [activeTab, setActiveTab] = useState<"todo" | "completed" | "timeplan">(
    "todo",
  );
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EditTaskData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showFlowerGarden, setShowFlowerGarden] = useState(false);
  const [streakEnabledLive, setStreakEnabledLive] = useState(false);
  const [studentProfileData, setStudentProfileData] = useState<{
    current_xp: number;
    current_goal_total: number;
    points_earned: number;
    flowers_collected: number;
    show_flower_garden: boolean;
    current_streak: number;
    longest_streak: number;
  }>({
    current_xp: 0,
    current_goal_total: 1000,
    points_earned: 0,
    flowers_collected: 0,
    show_flower_garden: false,
    current_streak: 0,
    longest_streak: 0,
  });

  const supabase = createClient();

  useEffect(() => {
    fetchStudent();
    fetchTasks();
    fetchStudentProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

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

      const studentData: StudentProfile = {
        id: data.id,
        full_name: data.profiles.full_name,
        avatar_url: data.profiles.avatar_url,
        level: data.level,
        class_name: data.classes?.name || null,
        class_id: data.class_id || null,
        custom_welcome_message: data.custom_welcome_message || "",
        current_password_plaintext: data.current_password_plaintext || null,
        streak_enabled: data.streak_enabled ?? false,
        streak_mode: data.streak_mode ?? "classic",
      };

      setStudent(studentData);
      setStreakEnabledLive(studentData.streak_enabled);
      // Track visit for "Nylig besøkte elever" widget
      if (teacherProfile?.id) {
        recordStudentVisit(teacherProfile.id, {
          id: studentData.id,
          full_name: studentData.full_name,
          avatar_url: studentData.avatar_url,
        });
      }
    } catch {
      // Silent – student profile shows loading state
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
          subject_id,
          quiz_data,
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
          subject_id: task.subject_id || null,
          subject: task.subject?.title || "Ukjent",
          quiz_data: task.quiz_data || null,
        })) || [];

      setTasks(mappedTasks);
    } catch {
      // Silent – tasks list stays empty
    }
  };

  const fetchStudentProfileData = async () => {
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select(
          "current_xp, current_goal_total, points_earned, flowers_collected, show_flower_garden, current_streak, longest_streak",
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
          show_flower_garden: data.show_flower_garden ?? false,
          current_streak: data.current_streak || 0,
          longest_streak: data.longest_streak || 0,
        });
        setShowFlowerGarden(data.show_flower_garden ?? false);
      }
    } catch {
      // Silent – profile data keeps defaults
    }
  };

  // ── Class change callback ───────────────────────────
  const handleClassChanged = (className: string, level: number | null) => {
    if (student && level !== null) {
      setStudent({ ...student, class_name: className, level });
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

  const handleTaskCreated = async () => {
    await fetchTasks();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description,
      subject_id: task.subject_id || "",
      type: (task.type as "standard" | "quiz") || "standard",
      grade_level: null,
      quiz_data: task.quiz_data || null,
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setConfirmState({
      title: "Slett oppgave",
      description: "Er du sikker på at du vil slette denne oppgaven?",
      action: async () => {
        try {
          const { error } = await supabase
            .from("tasks")
            .delete()
            .eq("id", taskId);

          if (error) throw error;

          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          showToast("Oppgave slettet!", "success");
        } catch {
          showToast("Kunne ikke slette oppgave. Prøv igjen.", "error");
        }
      },
    });
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
              Tilbake til Mine Elever
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
        <StudentSettingsCard
          studentId={studentId}
          initialWelcomeMessage={student.custom_welcome_message}
          initialStreakEnabled={student.streak_enabled}
          initialStreakMode={student.streak_mode}
          initialFlowerGardenEnabled={showFlowerGarden}
          showToast={showToast}
          onFlowerToggle={setShowFlowerGarden}
          onStreakToggle={setStreakEnabledLive}
        />

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
                {isImageUrl(student.avatar_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.avatar_url}
                    alt={student.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">
                    {student.avatar_url ||
                      student.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">
                  {student.full_name}
                </h4>
              </div>
            </div>

            {/* Class Selection — Combobox */}
            <ClassCombobox
              studentId={studentId}
              initialClassName={student.class_name}
              onClassChanged={handleClassChanged}
            />

            {/* Password Section */}
            <StudentPasswordCard
              studentId={studentId}
              initialPassword={student.current_password_plaintext}
              showToast={showToast}
            />
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

            {/* Flowers — only if garden is enabled */}
            {showFlowerGarden && (
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
            )}

            {/* Streak — only if streak is enabled */}
            {streakEnabledLive && (
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-medium text-slate-700">
                    Streak
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-orange-700">
                    {studentProfileData.current_streak}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">
                    (maks {studentProfileData.longest_streak})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Reward Options (Level-Up Selection) */}
        <StudentRewardManager
          studentId={studentId}
          studentName={student.full_name}
          showToast={showToast}
        />

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

      {/* Create / Edit Task Modal */}
      <TaskCreatorModal
        isOpen={isCreateTaskModalOpen || !!editingTask}
        onClose={() => {
          setIsCreateTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSuccess={handleTaskCreated}
        initialStudentId={studentId}
        editTask={editingTask}
      />

      <Toast toast={toast} onClose={hideToast} />
      <ConfirmDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
