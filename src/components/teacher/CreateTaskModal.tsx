"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { X } from "lucide-react";
import { SubjectTheme } from "@/utils/subject-colors";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import { EmojiPickerButton } from "@/components/ui/emoji-picker";
import { ColorPickerGrid } from "@/components/ui/color-picker-grid";
import type { QuizQuestion, Subject } from "@/types/shared";
import QuizBuilder from "./QuizBuilder";
import RecipientPicker, {
  type RecipientPickerRef,
  type RecipientEligibility,
} from "./RecipientPicker";
import SchedulePicker, { type SchedulePickerRef } from "./SchedulePicker";

// Types
type TaskFormData = {
  title: string;
  description: string;
  subject_id: string;
  points_value: number;
  due_date: string;
  type: "standard" | "quiz";
};

// Edit data shape (matches task_library columns)
export type EditTaskData = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  type: "standard" | "quiz";
  grade_level: string | null;
  quiz_data: QuizQuestion[] | null;
};

// Props Interface
interface TaskCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialStudentId?: string | null;
  editTask?: EditTaskData | null;
}

export default function TaskCreatorModal({
  isOpen,
  onClose,
  onSuccess,
  initialStudentId,
  editTask = null,
}: TaskCreatorModalProps) {
  const isEditMode = !!editTask;
  const { toast, showToast, hideToast } = useToast();
  // Task Form State
  const [taskForm, setTaskForm] = useState<TaskFormData>({
    title: "",
    description: "",
    subject_id: "",
    points_value: 50,
    due_date: "",
    type: "standard",
  });
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [newSubjectEmoji, setNewSubjectEmoji] = useState("📚");
  const [newSubjectColor, setNewSubjectColor] = useState<SubjectTheme>("red");

  // Quiz State (controlled — passed to QuizBuilder)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  // Subjects State
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Recipient eligibility (reported by RecipientPicker)
  const [recipientEligibility, setRecipientEligibility] =
    useState<RecipientEligibility>({
      classId: null,
      studentId: null,
      studentCount: 0,
    });

  const supabase = createClient();

  // Refs
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const recipientRef = useRef<RecipientPickerRef>(null);
  const scheduleRef = useRef<SchedulePickerRef>(null);

  // Stable callback for RecipientPicker
  const handleEligibilityChange = useCallback(
    (elig: RecipientEligibility) => setRecipientEligibility(elig),
    [],
  );

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubjects();

      if (editTask) {
        // Pre-fill form for editing
        setTaskForm({
          title: editTask.title,
          description: editTask.description || "",
          subject_id: editTask.subject_id || "",
          points_value: 50,
          due_date: "",
          type: editTask.type || "standard",
        });
        if (editTask.quiz_data) {
          setQuizQuestions(editTask.quiz_data);
        }
      } else {
        // Reset form for create mode
        resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editTask]);

  // Auto-scroll to quiz builder when quiz mode is selected
  useEffect(() => {
    if (taskForm.type === "quiz" && leftColumnRef.current) {
      setTimeout(() => {
        leftColumnRef.current?.scrollTo({
          top: leftColumnRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [taskForm.type]);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, title, emoji, color_theme")
        .order("title");

      if (error) throw error;
      setSubjects(data || []);
    } catch {
      // Silent – subjects list stays empty
    }
  };

  const resetForm = () => {
    setTaskForm({
      title: "",
      description: "",
      subject_id: "",
      points_value: 50,
      due_date: "",
      type: "standard",
    });
    setCustomSubjectName("");
    setNewSubjectEmoji("📚");
    setNewSubjectColor("red");
    setQuizQuestions([]);
  };

  // ---------- Subject creation helper (shared by create & update) ----------

  const resolveSubjectId = async (): Promise<string | null> => {
    if (taskForm.subject_id !== "custom") return taskForm.subject_id;
    if (!customSubjectName.trim()) {
      showToast("Vennligst skriv inn fagnavn", "warning");
      return null;
    }

    const { data: newSubject, error: subjectError } = await supabase
      .from("subjects")
      .insert([
        {
          title: customSubjectName.trim(),
          emoji: newSubjectEmoji,
          color_theme: newSubjectColor,
        },
      ])
      .select()
      .single();

    if (subjectError) {
      if (subjectError.code === "23505") {
        const { data: existing, error: selectError } = await supabase
          .from("subjects")
          .select("*")
          .ilike("title", customSubjectName.trim())
          .single();
        if (selectError) throw selectError;
        setSubjects((prev) => {
          const exists = prev.some((s) => s.id === existing.id);
          return exists ? prev : [...prev, existing];
        });
        return existing.id;
      }
      throw subjectError;
    }

    setSubjects((prev) => [...prev, newSubject]);
    return newSubject.id;
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      showToast("Vennligst skriv inn en tittel", "warning");
      return;
    }

    // Validate subject selection
    if (!taskForm.subject_id) {
      showToast("Vennligst velg et fag", "warning");
      return;
    }

    // Validate custom subject if selected
    if (taskForm.subject_id === "custom" && !customSubjectName.trim()) {
      showToast("Vennligst skriv inn fagnavn", "warning");
      return;
    }

    // Validate quiz questions if type is quiz
    if (taskForm.type === "quiz") {
      if (quizQuestions.length === 0) {
        showToast(
          "Vennligst legg til minst ett spørsmål for quizen",
          "warning",
        );
        return;
      }

      // Validate that radio/checkbox questions have options
      const invalidQuestions = quizQuestions.filter(
        (q) =>
          (q.answerType === "radio" || q.answerType === "checkbox") &&
          q.options.length === 0,
      );

      if (invalidQuestions.length > 0) {
        showToast(
          "Alle flervalg-spørsmål må ha minst ett alternativ",
          "warning",
        );
        return;
      }
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const finalSubjectId = await resolveSubjectId();
      if (!finalSubjectId) return;

      // STEP 1: Always save to task_library first
      const { data: libraryTask, error: libraryError } = await supabase
        .from("task_library")
        .insert({
          title: taskForm.title,
          description: taskForm.description,
          subject_id: finalSubjectId,
          type: taskForm.type,
          quiz_data: taskForm.type === "quiz" ? quizQuestions : null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (libraryError) throw libraryError;

      // STEP 2: Check if any students are selected for assignment
      const targetStudentIds =
        recipientRef.current?.getSelectedStudentIds() ?? [];

      if (targetStudentIds.length > 0) {
        // Create task assignments for selected students
        const tasksToInsert = targetStudentIds.map((sid) => ({
          title: taskForm.title,
          description: taskForm.description,
          subject_id: finalSubjectId,
          points_value: taskForm.points_value,
          due_date: taskForm.due_date || null,
          student_id: sid,
          created_by: user?.id || null,
          is_completed: false,
          type: taskForm.type,
          quiz_data: taskForm.type === "quiz" ? quizQuestions : null,
          task_library_id: libraryTask.id,
        }));

        const { data: insertedTasks, error: assignError } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
          .select();

        if (assignError) throw assignError;

        const scheduleEntryIds =
          scheduleRef.current?.getSelectedEntryIds() ?? new Set<string>();

        if (insertedTasks && scheduleEntryIds.size > 0) {
          const junctionRows = insertedTasks.flatMap((task) =>
            Array.from(scheduleEntryIds).map((entryId) => ({
              task_id: task.id,
              schedule_entry_id: entryId,
            })),
          );

          if (junctionRows.length > 0) {
            const { error: junctionError } = await supabase
              .from("task_schedule_entries")
              .insert(junctionRows);

            if (junctionError) throw junctionError;
          }
        }
      }

      // Success! Reset form and close modal
      resetForm();
      onClose();

      // Smart success message
      const successMessage =
        targetStudentIds.length === 0
          ? "Lagret i Oppgavebiblioteket"
          : `Lagret i bibliotek og tildelt ${targetStudentIds.length} ${
              targetStudentIds.length === 1 ? "elev" : "elever"
            }`;
      showToast(successMessage, "success");

      // Notify parent to refresh
      onSuccess();
    } catch {
      showToast("Kunne ikke opprette oppgave. Prøv igjen.", "error");
    }
  };

  const handleUpdateTask = async () => {
    if (!editTask) return;
    if (!taskForm.title.trim()) {
      showToast("Vennligst skriv inn en tittel", "warning");
      return;
    }
    if (!taskForm.subject_id) {
      showToast("Vennligst velg et fag", "warning");
      return;
    }

    try {
      const finalSubjectId = await resolveSubjectId();
      if (!finalSubjectId) return;

      const { error } = await supabase
        .from("task_library")
        .update({
          title: taskForm.title,
          description: taskForm.description,
          subject_id: finalSubjectId,
          type: taskForm.type,
          quiz_data: taskForm.type === "quiz" ? quizQuestions : null,
        })
        .eq("id", editTask.id);

      if (error) throw error;

      resetForm();
      onClose();
      onSuccess();
    } catch {
      showToast("Kunne ikke oppdatere oppgave. Prøv igjen.", "error");
    }
  };

  if (!isOpen) return null;

  const selectedCount = isEditMode
    ? 0
    : recipientEligibility.studentCount;
  const buttonText = isEditMode
    ? "Lagre endringer"
    : selectedCount === 0
      ? "Lagre i bibliotek"
      : "Lagre og tildel";

  const scheduleDisabled =
    !recipientEligibility.classId || !taskForm.subject_id;
  const scheduleHint = !recipientEligibility.classId
    ? "Tidsstyring er kun tilgjengelig når mottakere tilhører samme klasse"
    : !taskForm.subject_id
      ? "Velg fag for å knytte til time"
      : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-6xl w-full h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 shrink-0 bg-white z-20 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {isEditMode ? "Rediger oppgave" : "Opprett ny oppgave"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body - Dashboard Grid */}
        <div
          className={`flex-1 min-h-0 grid ${isEditMode ? "grid-cols-1" : "grid-cols-12"}`}
        >
          {/* LEFT COLUMN - Content Definition */}
          <div
            ref={leftColumnRef}
            className={`${isEditMode ? "" : "col-span-7"} p-6 overflow-y-auto flex flex-col gap-5 ${
              taskForm.type === "quiz" ? "pb-40" : "pb-6"
            }`}
          >
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
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
                placeholder="Kort beskrivelse av oppgaven..."
                rows={5}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Subject Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fag
              </label>
              <select
                value={taskForm.subject_id}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, subject_id: e.target.value })
                }
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Velg fag --</option>
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.emoji} {subj.title}
                  </option>
                ))}
                <option value="custom">➡️ Lag nytt fag...</option>
              </select>
            </div>

            {/* Custom Subject Creation */}
            {taskForm.subject_id === "custom" && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Opprett nytt fag
                </h3>

                {/* Row 1: Subject Title */}
                <input
                  type="text"
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  placeholder="Fagnavn..."
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />

                {/* Row 2: Emoji + Color Picker */}
                <div className="flex gap-3 items-start">
                  {/* Emoji Picker */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Emoji
                    </p>
                    <EmojiPickerButton
                      value={newSubjectEmoji}
                      onChange={setNewSubjectEmoji}
                      placeholder="📚"
                    />
                  </div>

                  {/* Color Picker */}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Farge
                    </p>
                    <ColorPickerGrid
                      value={newSubjectColor}
                      onChange={setNewSubjectColor}
                      usedColors={
                        new Set(
                          subjects.map((s) => s.color_theme as SubjectTheme),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Task Type Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTaskForm({ ...taskForm, type: "standard" })}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    taskForm.type === "standard"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  📝 Vanlig Oppgave
                </button>
                <button
                  type="button"
                  onClick={() => setTaskForm({ ...taskForm, type: "quiz" })}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    taskForm.type === "quiz"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ✅ Quiz / Test
                </button>
              </div>
            </div>

            {/* Quiz Builder (only for quiz type) */}
            {taskForm.type === "quiz" && (
              <QuizBuilder
                questions={quizQuestions}
                onQuestionsChange={setQuizQuestions}
                showToast={showToast}
              />
            )}
          </div>

          {/* RIGHT COLUMN - Inspector Panel (hidden in edit mode) */}
          {!isEditMode && (
            <div className="col-span-5 h-full border-l bg-slate-50/50 flex flex-col overflow-hidden">
              {/* Recipient Picker Section */}
              <RecipientPicker
                ref={recipientRef}
                initialStudentId={initialStudentId}
                onEligibilityChange={handleEligibilityChange}
              />

              {/* Settings Section - Pinned Bottom */}
              <div className="p-4 border-t bg-white shrink-0">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Innstillinger
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* Points Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    />
                  </div>

                  {/* Due Date Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Frist
                    </label>
                    <input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, due_date: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    />
                  </div>
                </div>

                <SchedulePicker
                  ref={scheduleRef}
                  classId={recipientEligibility.classId}
                  studentId={recipientEligibility.studentId}
                  subjectId={taskForm.subject_id}
                  dueDate={taskForm.due_date}
                  disabled={scheduleDisabled}
                  hint={scheduleHint}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-gray-50 shrink-0 z-20 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={isEditMode ? handleUpdateTask : handleCreateTask}
            disabled={!taskForm.title.trim()}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed ${
              isEditMode || selectedCount === 0
                ? "text-indigo-600 bg-white border-2 border-indigo-600 hover:bg-indigo-50"
                : "text-white bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {buttonText}
          </button>
        </div>
      </div>
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
