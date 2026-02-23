"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search,
  Users,
  ArrowRight,
  Edit2,
  Trash2,
  Loader2,
  Settings,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { getSubjectTheme } from "@/utils/subject-colors";
import type { SubjectTheme } from "@/utils/subject-colors";
import CreateTaskButton from "@/components/teacher/CreateTaskButton";
import TaskCreatorModal from "@/components/teacher/CreateTaskModal";
import type { EditTaskData } from "@/components/teacher/CreateTaskModal";
import { updateSubject, deleteSubject } from "@/app/actions/manage-subjects";
import { EmojiPickerButton } from "@/components/ui/emoji-picker";
import { ColorPickerGrid } from "@/components/ui/color-picker-grid";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Subject {
  id: string;
  title: string;
  emoji: string;
  color_theme: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  subject_id: string;
  subjectColor: string;
  type: "standard" | "quiz";
  gradeLevel: string;
  assignCount: number;
  quiz_data: any;
}

interface TaskLibraryItem {
  id: string;
  title: string;
  type: "standard" | "quiz";
  grade_level: string;
  usage_count: number;
  subject: {
    title: string;
    emoji: string;
    color_theme: string;
  };
}

export default function TaskLibraryPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<EditTaskData | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [withdrawTasks, setWithdrawTasks] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    visible: boolean;
  }>({ message: "", type: "success", visible: false });

  // Subject Admin state
  const [subjectAdminOpen, setSubjectAdminOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    emoji: "",
    color_theme: "blue" as SubjectTheme,
  });
  const [subjectActionLoading, setSubjectActionLoading] = useState(false);

  const supabase = createClient();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  };

  // ── Subject Admin handlers ──

  const startEditingSubject = useCallback((subject: Subject) => {
    setEditingSubjectId(subject.id);
    setEditForm({
      title: subject.title,
      emoji: subject.emoji,
      color_theme: subject.color_theme as SubjectTheme,
    });
  }, []);

  const cancelEditingSubject = useCallback(() => {
    setEditingSubjectId(null);
  }, []);

  const handleUpdateSubject = useCallback(async () => {
    if (!editingSubjectId || !editForm.title.trim()) return;
    setSubjectActionLoading(true);
    const result = await updateSubject(editingSubjectId, editForm);
    setSubjectActionLoading(false);
    if (result.success) {
      showToast("Faget ble oppdatert", "success");
      setEditingSubjectId(null);
      fetchSubjects();
    } else {
      showToast(result.error, "error");
    }
  }, [editingSubjectId, editForm]);

  const handleDeleteSubject = useCallback(async (id: string) => {
    setSubjectActionLoading(true);
    const result = await deleteSubject(id);
    setSubjectActionLoading(false);
    if (result.success) {
      showToast("Faget ble slettet", "success");
      fetchSubjects();
    } else {
      showToast(result.error, "error");
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
    fetchTasks();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("title", { ascending: true });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_library")
        .select(
          `
          *,
          subject:subjects (
            title,
            emoji,
            color_theme
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map database response to TaskTemplate interface
      const mappedTasks: TaskTemplate[] =
        data?.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description || null,
          subject: task.subject?.title || "Ukjent",
          subject_id: task.subject_id,
          subjectColor: task.subject?.color_theme || "blue",
          type: task.type,
          gradeLevel: task.grade_level || "Alle trinn",
          assignCount: task.usage_count || 0,
          quiz_data: task.quiz_data || null,
        })) || [];

      setTasks(mappedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  // Define core subjects
  const CORE_SUBJECTS = [
    "Matte",
    "Matematikk",
    "Norsk",
    "Engelsk",
    "Samfunnsfag",
    "Naturfag",
    "KRLE",
    "Gym",
    "Kroppsøving",
    "Kunst og håndverk",
    "Musikk",
    "Mat og helse",
  ];

  // Split subjects into main (core) and other lists
  const mainSubjects = subjects.filter((subject) =>
    CORE_SUBJECTS.some((core) =>
      subject.title.toLowerCase().includes(core.toLowerCase()),
    ),
  );

  const otherSubjects = subjects.filter(
    (subject) =>
      !CORE_SUBJECTS.some((core) =>
        subject.title.toLowerCase().includes(core.toLowerCase()),
      ),
  );

  // Filter tasks based on selected subject and search query
  const filteredTasks = tasks.filter((task) => {
    const matchesSubject = !selectedSubject || task.subject === selectedSubject;
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const handleEditTask = (task: TaskTemplate) => {
    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description,
      subject_id: task.subject_id,
      type: task.type,
      grade_level: task.gradeLevel,
      quiz_data: task.quiz_data,
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsDeleting(true);
    try {
      // Step A (Conditional): Withdraw uncompleted student tasks first
      // This must happen BEFORE deleting the library item because
      // ON DELETE SET NULL would sever the link otherwise.
      let withdrawnCount = 0;
      if (withdrawTasks) {
        const { error: withdrawError, count } = await supabase
          .from("tasks")
          .delete({ count: "exact" })
          .eq("task_library_id", taskId)
          .eq("is_completed", false);

        if (withdrawError) {
          console.error("Supabase withdraw error:", withdrawError);
          throw withdrawError;
        }
        withdrawnCount = count ?? 0;
      }

      // Step B (Always): Delete the library item itself
      const { error, count } = await supabase
        .from("task_library")
        .delete({ count: "exact" })
        .eq("id", taskId);

      if (error) {
        console.error("Supabase delete error:", error);
        throw error;
      }

      if (count === 0) {
        console.warn(
          "Delete returned 0 affected rows — likely an RLS policy issue. taskId:",
          taskId,
        );
        throw new Error(
          "Ingen rader ble slettet. Sjekk at du har rettigheter til å slette denne oppgaven.",
        );
      }

      // Success — remove from local state
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setDeletingTaskId(null);
      setWithdrawTasks(false);

      if (withdrawnCount > 0) {
        showToast(
          `Oppgaven ble slettet og ${withdrawnCount} ufullførte oppgaver ble trukket tilbake`,
          "success",
        );
      } else {
        showToast("Oppgaven ble slettet", "success");
      }
    } catch (error: any) {
      console.error("Error deleting task:", error);
      showToast(
        error?.message || "Kunne ikke slette oppgave. Prøv igjen.",
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Subject Filter */}
      <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Filtrer etter fag
            </h2>
            <button
              onClick={() => setSubjectAdminOpen(true)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Administrer fag"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* All Tasks */}
          <button
            onClick={() => setSelectedSubject(null)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors font-semibold ${
              selectedSubject === null
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="mr-2">📚</span>
            Alle oppgaver
          </button>

          {/* Divider */}
          <div className="border-b border-gray-200 my-2" />

          {/* Subject List */}
          {loading ? (
            <div className="text-sm text-gray-500 px-3 py-2">Laster...</div>
          ) : (
            <>
              {/* Core Subjects */}
              {mainSubjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubject(subject.title)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                    selectedSubject === subject.title
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-2">{subject.emoji}</span>
                  {subject.title}
                </button>
              ))}

              {/* Other Topics - Accordion */}
              {otherSubjects.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg list-none flex items-center justify-between">
                    <span>Andre emner</span>
                    <span className="text-xs text-gray-400">▼</span>
                  </summary>
                  <div className="mt-1">
                    {otherSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => setSelectedSubject(subject.title)}
                        className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                          selectedSubject === subject.title
                            ? "bg-indigo-50 text-indigo-700 font-medium"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className="mr-2">{subject.emoji}</span>
                        {subject.title}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Oppgavebibliotek
            </h1>

            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Søk i oppgaver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* New Task Button */}
              <CreateTaskButton />
            </div>
          </div>

          {/* Task Grid */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {searchQuery
                  ? "Ingen oppgaver matcher søket ditt"
                  : "Ingen oppgaver funnet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((task) => {
                const theme = getSubjectTheme(task.subjectColor);

                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleEditTask(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleEditTask(task);
                      }
                    }}
                    className="group relative h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all duration-150 hover:-translate-y-[2px] hover:shadow-md overflow-hidden"
                  >
                    {/* Top color strip */}
                    <div className={`h-1.5 w-full ${theme.base}`} />

                    <div className="p-5 flex-1 flex flex-col">
                      {/* Header row with badges & hover action icons */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          {/* Badges Row - Subject, Grade, Type */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {/* Badge 1: Subject */}
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-medium ${theme.light} ${theme.text} border-transparent`}
                            >
                              {task.subject}
                            </span>
                            {/* Badge 2: Grade */}
                            <span className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-600 font-medium">
                              {task.gradeLevel}
                            </span>
                            {/* Badge 3: Type */}
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-medium ${
                                task.type === "quiz"
                                  ? "border-purple-200 text-purple-700"
                                  : "border-gray-200 text-gray-600"
                              }`}
                            >
                              {task.type === "quiz" ? "Quiz" : "Oppgave"}
                            </span>
                          </div>
                          {/* Title */}
                          <h3 className="font-bold text-gray-900 text-lg leading-snug">
                            {task.title}
                          </h3>
                        </div>

                        {/* Hover action icons – hidden by default, shown on card hover */}
                        <div
                          className="hidden group-hover:flex gap-1 flex-shrink-0 items-center -mt-1 -mr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTask(task);
                            }}
                            className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                            title="Rediger"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingTaskId(task.id);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                            title="Slett"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Spacer to push footer down */}
                      <div className="flex-1"></div>

                      {/* Footer - Sticky Bottom */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        {/* Stats - Left Side */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          <span>Tildelt {task.assignCount} ganger</span>
                        </div>

                        {/* Action Button - Right Side */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log("Assign task clicked:", task.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors"
                        >
                          Tildel
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Edit Task Modal */}
      <TaskCreatorModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSuccess={() => {
          setEditingTask(null);
          fetchTasks();
        }}
        editTask={editingTask}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTaskId(null);
            setWithdrawTasks(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne oppgaven? Dette fjerner
              oppgaven fra biblioteket.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Withdraw uncompleted tasks option */}
          <label className="flex items-start gap-3 py-3 px-1 rounded-md cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withdrawTasks}
              onChange={(e) => setWithdrawTasks(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800">
                Trekk tilbake ufullførte oppgaver
              </span>
              <span className="text-xs text-slate-500 mt-0.5">
                Sletter også denne oppgaven fra elevenes timeplaner, forutsatt
                at de ikke har fullført den ennå.
              </span>
            </div>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              autoClose={false}
              onClick={() => {
                if (deletingTaskId) handleDeleteTask(deletingTaskId);
              }}
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sletter…
                </span>
              ) : (
                "Slett"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subject Admin Dialog */}
      <AlertDialog
        open={subjectAdminOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSubjectAdminOpen(false);
            setEditingSubjectId(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Administrer fag</AlertDialogTitle>
            <AlertDialogDescription>
              Rediger eller slett fag. Fag som er i bruk kan ikke slettes.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                Ingen fag funnet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {subjects.map((subject) => {
                  const isEditing = editingSubjectId === subject.id;
                  const usedColors = new Set(
                    subjects
                      .filter((s) => s.id !== subject.id)
                      .map((s) => s.color_theme as SubjectTheme),
                  );

                  return (
                    <li key={subject.id} className="py-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          {/* Edit row: emoji + name */}
                          <div className="flex items-center gap-2">
                            <EmojiPickerButton
                              value={editForm.emoji}
                              onChange={(emoji) =>
                                setEditForm((f) => ({ ...f, emoji }))
                              }
                            />
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  title: e.target.value,
                                }))
                              }
                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Color picker */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Farge:
                            </span>
                            <ColorPickerGrid
                              value={editForm.color_theme}
                              onChange={(color) =>
                                setEditForm((f) => ({
                                  ...f,
                                  color_theme: color,
                                }))
                              }
                              usedColors={usedColors}
                            />
                          </div>

                          {/* Save / Cancel */}
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEditingSubject}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              title="Avbryt"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleUpdateSubject}
                              disabled={
                                subjectActionLoading || !editForm.title.trim()
                              }
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Lagre"
                            >
                              {subjectActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{subject.emoji}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {subject.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditingSubject(subject)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Rediger"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubject(subject.id)}
                              disabled={subjectActionLoading}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Slett"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Lukk</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toast Notification */}
      {toast.visible && (
        <div
          className={`fixed bottom-4 right-4 z-[10001] px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-opacity ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
