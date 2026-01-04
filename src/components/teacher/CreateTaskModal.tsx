"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, X, Trash2 } from "lucide-react";

// Types
type TaskFormData = {
  title: string;
  description: string;
  subject_id: string;
  grade_level: string;
  points_value: number;
  due_date: string;
  type: "standard" | "quiz";
};

type QuizQuestion = {
  id: string;
  text: string;
  answerType: "text" | "radio" | "checkbox";
  options: string[];
};

type ClassOption = {
  id: string;
  name: string;
};

type StudentOption = {
  id: string;
  name: string;
  class_name: string;
};

type Subject = {
  id: string;
  title: string;
  emoji: string;
  color_theme: string;
};

// Props Interface
interface TaskCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialStudentId?: string | null;
}

export default function TaskCreatorModal({
  isOpen,
  onClose,
  onSuccess,
  initialStudentId,
}: TaskCreatorModalProps) {
  // Task Form State
  const [taskForm, setTaskForm] = useState<TaskFormData>({
    title: "",
    description: "",
    subject_id: "",
    grade_level: "5. Trinn",
    points_value: 50,
    due_date: "",
    type: "standard",
  });
  const [customSubjectName, setCustomSubjectName] = useState("");

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<
    "text" | "radio" | "checkbox"
  >("text");

  // Recipient Picker State
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>(
    []
  );
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
    new Set()
  );
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    () => new Set(initialStudentId ? [initialStudentId] : [])
  );
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  // Subjects State
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const supabase = createClient();

  // Refs for scroll control
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const studentListRef = useRef<HTMLDivElement>(null);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubjects();
      fetchRecipientsData();
      // Pre-select initial student if provided
      if (initialStudentId) {
        setSelectedStudents(new Set([initialStudentId]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStudentId]);

  // Auto-scroll to pre-selected student(s)
  useEffect(() => {
    if (isOpen && selectedStudents.size > 0 && availableStudents.length > 0) {
      setTimeout(() => {
        // Get the first selected student ID
        const firstSelectedId = Array.from(selectedStudents)[0];
        const row = document.getElementById(`student-row-${firstSelectedId}`);
        if (row) {
          // Use scrollIntoView for better nested scroll support
          row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200); // Longer delay to ensure all nested elements are rendered
    }
  }, [isOpen, selectedStudents, availableStudents]);

  // Auto-scroll to quiz builder when quiz mode is selected
  useEffect(() => {
    if (taskForm.type === "quiz" && leftColumnRef.current) {
      // Wait a tick for render
      setTimeout(() => {
        // Scroll to the bottom of the container smoothly
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
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchRecipientsData = async () => {
    setIsLoadingRecipients(true);
    setRecipientsError(null);
    try {
      // Fetch all students with their class information
      const { data: allStudents, error: studentsError } = await supabase
        .from("student_profiles")
        .select(
          `
          id,
          profiles!inner (
            full_name
          ),
          classes (
            id,
            name
          )
        `
        )
        .order("classes(name)", { ascending: true });

      if (studentsError) {
        console.error("Supabase error fetching students:", studentsError);
        throw studentsError;
      }

      // Extract unique classes
      const uniqueClasses = new Map<string, ClassOption>();
      const processedStudents: StudentOption[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allStudents?.forEach((student: any) => {
        const classInfo = student.classes;
        const fullName = student.profiles?.full_name;

        if (classInfo && !uniqueClasses.has(classInfo.id)) {
          uniqueClasses.set(classInfo.id, {
            id: classInfo.id,
            name: classInfo.name,
          });
        }

        if (fullName && classInfo) {
          processedStudents.push({
            id: student.id,
            name: fullName,
            class_name: classInfo.name,
          });
        }
      });

      setAvailableClasses(Array.from(uniqueClasses.values()));
      setAvailableStudents(processedStudents);
      setIsLoadingRecipients(false);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      setRecipientsError(
        "Kunne ikke laste elever og klasser. Prøv igjen senere."
      );
      setIsLoadingRecipients(false);
    }
  };

  // Quiz Management Functions
  const addQuizQuestion = () => {
    if (!newQuestionText.trim()) {
      alert("Vennligst skriv inn et spørsmål");
      return;
    }

    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      text: newQuestionText,
      answerType: newQuestionType,
      options: [],
    };

    setQuizQuestions((prev) => [...prev, newQuestion]);
    setNewQuestionText("");
    setNewQuestionType("text");
  };

  const deleteQuizQuestion = (questionId: string) => {
    setQuizQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  const addOptionToQuestion = (questionId: string, option: string) => {
    if (!option.trim()) return;

    setQuizQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, option] } : q
      )
    );
  };

  const removeOptionFromQuestion = (
    questionId: string,
    optionIndex: number
  ) => {
    setQuizQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((_, i) => i !== optionIndex) }
          : q
      )
    );
  };

  // Recipient Picker Helper Functions
  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) => {
      const newSet = new Set(prev);
      const isAdding = !newSet.has(classId);

      if (isAdding) {
        newSet.add(classId);
        // Also select all students in this class
        const studentsInClass = availableStudents
          .filter(
            (student) =>
              student.class_name ===
              availableClasses.find((c) => c.id === classId)?.name
          )
          .map((student) => student.id);
        setSelectedStudents((prevStudents) => {
          const newStudents = new Set(prevStudents);
          studentsInClass.forEach((id) => newStudents.add(id));
          return newStudents;
        });
      } else {
        newSet.delete(classId);
        // Also deselect all students in this class
        const studentsInClass = availableStudents
          .filter(
            (student) =>
              student.class_name ===
              availableClasses.find((c) => c.id === classId)?.name
          )
          .map((student) => student.id);
        setSelectedStudents((prevStudents) => {
          const newStudents = new Set(prevStudents);
          studentsInClass.forEach((id) => newStudents.delete(id));
          return newStudents;
        });
      }

      return newSet;
    });
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const getSelectedStudentIds = (): string[] => {
    const uniqueIds = new Set(selectedStudents);

    // Add students from selected classes
    selectedClasses.forEach((classId) => {
      availableStudents
        .filter((student) => student.class_name === classId)
        .forEach((student) => uniqueIds.add(student.id));
    });

    return Array.from(uniqueIds);
  };

  const getFilteredStudents = (): StudentOption[] => {
    if (!studentSearchQuery.trim()) return availableStudents;

    const query = studentSearchQuery.toLowerCase();
    return availableStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.class_name.toLowerCase().includes(query)
    );
  };

  const resetForm = () => {
    setTaskForm({
      title: "",
      description: "",
      subject_id: "",
      grade_level: "5. Trinn",
      points_value: 50,
      due_date: "",
      type: "standard",
    });
    setCustomSubjectName("");
    setQuizQuestions([]);
    setNewQuestionText("");
    setNewQuestionType("text");
    setSelectedClasses(new Set());
    setSelectedStudents(new Set(initialStudentId ? [initialStudentId] : []));
    setStudentSearchQuery("");
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      alert("Vennligst skriv inn en tittel");
      return;
    }

    // Validate subject selection
    if (!taskForm.subject_id) {
      alert("Vennligst velg et fag");
      return;
    }

    // Validate custom subject if selected
    if (taskForm.subject_id === "custom" && !customSubjectName.trim()) {
      alert("Vennligst skriv inn fagnavn");
      return;
    }

    // Validate quiz questions if type is quiz
    if (taskForm.type === "quiz") {
      if (quizQuestions.length === 0) {
        alert("Vennligst legg til minst ett spørsmål for quizen");
        return;
      }

      // Validate that radio/checkbox questions have options
      const invalidQuestions = quizQuestions.filter(
        (q) =>
          (q.answerType === "radio" || q.answerType === "checkbox") &&
          q.options.length === 0
      );

      if (invalidQuestions.length > 0) {
        alert("Alle flervalg-spørsmål må ha minst ett alternativ");
        return;
      }
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let finalSubjectId = taskForm.subject_id;

      // Create new subject if custom option is selected
      if (taskForm.subject_id === "custom") {
        const { data: newSubject, error: subjectError } = await supabase
          .from("subjects")
          .insert([
            {
              title: customSubjectName.trim(),
              emoji: "📚",
              color_theme: "gray",
            },
          ])
          .select()
          .single();

        // Handle unique constraint violation gracefully
        if (subjectError) {
          if (subjectError.code === "23505") {
            // Subject already exists, fetch it instead
            const { data: existingSubject, error: selectError } = await supabase
              .from("subjects")
              .select("*")
              .ilike("title", customSubjectName.trim())
              .single();

            if (selectError) throw selectError;
            finalSubjectId = existingSubject.id;

            // Add to subjects list if not already there
            setSubjects((prev) => {
              const exists = prev.some((s) => s.id === existingSubject.id);
              return exists ? prev : [...prev, existingSubject];
            });
          } else {
            throw subjectError;
          }
        } else {
          finalSubjectId = newSubject.id;

          // Add to subjects list
          setSubjects((prev) => [...prev, newSubject]);
        }
      }

      // STEP 1: Always save to task_library first
      const { data: libraryTask, error: libraryError } = await supabase
        .from("task_library")
        .insert({
          title: taskForm.title,
          description: taskForm.description,
          subject_id: finalSubjectId,
          grade_level: taskForm.grade_level,
          type: taskForm.type,
          quiz_data: taskForm.type === "quiz" ? quizQuestions : null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (libraryError) throw libraryError;

      // STEP 2: Check if any students are selected for assignment
      const targetStudentIds = getSelectedStudentIds();

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
        }));

        const { error: assignError } = await supabase
          .from("tasks")
          .insert(tasksToInsert);

        if (assignError) throw assignError;
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
      alert(successMessage);

      // Notify parent to refresh
      onSuccess();
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Kunne ikke opprette oppgave. Prøv igjen.");
    }
  };

  if (!isOpen) return null;

  const selectedCount = getSelectedStudentIds().length;
  const buttonText =
    selectedCount === 0 ? "Lagre i bibliotek" : "Lagre og tildel";

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
            Opprett ny oppgave
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body - Dashboard Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-12">
          {/* LEFT COLUMN - Content Definition */}
          <div
            ref={leftColumnRef}
            className={`col-span-7 p-6 overflow-y-auto flex flex-col gap-5 ${
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

            {/* Subject and Grade Row */}
            <div className="grid grid-cols-2 gap-4">
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

              {/* Grade Level Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Trinn
                </label>
                <select
                  value={taskForm.grade_level}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, grade_level: e.target.value })
                  }
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">-- Velg trinn --</option>
                  <option value="1. Trinn">1. Trinn</option>
                  <option value="2. Trinn">2. Trinn</option>
                  <option value="3. Trinn">3. Trinn</option>
                  <option value="4. Trinn">4. Trinn</option>
                  <option value="5. Trinn">5. Trinn</option>
                  <option value="6. Trinn">6. Trinn</option>
                  <option value="7. Trinn">7. Trinn</option>
                  <option value="8. Trinn">8. Trinn</option>
                  <option value="9. Trinn">9. Trinn</option>
                  <option value="10. Trinn">10. Trinn</option>
                </select>
              </div>
            </div>

            {/* Custom Subject Input */}
            {taskForm.subject_id === "custom" && (
              <div>
                <input
                  type="text"
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  placeholder="Skriv inn fagnavn..."
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-indigo-50"
                />
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

            {/* Quiz Builder (Only for Quiz type) */}
            {taskForm.type === "quiz" && (
              <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Spørsmål ({quizQuestions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addQuizQuestion}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-300 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Legg til spørsmål
                  </button>
                </div>

                {/* New Question Builder */}
                <div className="space-y-3 mb-4 p-3 bg-white rounded-lg border border-indigo-200">
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Skriv spørsmålet her..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Svartype
                    </label>
                    <select
                      value={newQuestionType}
                      onChange={(e) =>
                        setNewQuestionType(
                          e.target.value as "text" | "radio" | "checkbox"
                        )
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="text">Tekstsvar</option>
                      <option value="radio">Flervalg (én riktig)</option>
                      <option value="checkbox">Flervalg (flere riktige)</option>
                    </select>
                  </div>
                </div>

                {/* Questions List */}
                {quizQuestions.length > 0 && (
                  <div className="space-y-2">
                    {quizQuestions.map((question, index) => (
                      <div
                        key={question.id}
                        className="p-3 bg-white rounded-lg border border-slate-200"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-indigo-600">
                              Spørsmål {index + 1}
                            </span>
                            <p className="text-sm text-slate-900 mt-1">
                              {question.text}
                            </p>
                            <span className="text-xs text-slate-500">
                              {question.answerType === "text" && "Tekstsvar"}
                              {question.answerType === "radio" &&
                                "Flervalg (én riktig)"}
                              {question.answerType === "checkbox" &&
                                "Flervalg (flere riktige)"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteQuizQuestion(question.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Options for radio/checkbox */}
                        {(question.answerType === "radio" ||
                          question.answerType === "checkbox") && (
                          <div className="mt-2 space-y-1">
                            {question.options.map((option, optionIndex) => (
                              <div
                                key={optionIndex}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded flex-1">
                                  {option}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeOptionFromQuestion(
                                      question.id,
                                      optionIndex
                                    )
                                  }
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <input
                              type="text"
                              placeholder="Legg til alternativ (trykk Enter)"
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const input = e.currentTarget;
                                  addOptionToQuestion(question.id, input.value);
                                  input.value = "";
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Inspector Panel */}
          <div className="col-span-5 h-full border-l bg-slate-50/50 flex flex-col overflow-hidden">
            {/* Recipient Picker Section - Scrollable */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Mottakere
                  </label>
                  <span className="text-xs text-slate-500">
                    {selectedClasses.size}{" "}
                    {selectedClasses.size === 1 ? "klasse" : "klasser"},{" "}
                    {selectedStudents.size}{" "}
                    {selectedStudents.size === 1 ? "elev" : "elever"}
                  </span>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto px-4 pb-4"
                ref={studentListRef}
              >
                {isLoadingRecipients ? (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-2"></div>
                    Laster elever og klasser...
                  </div>
                ) : recipientsError ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700 mb-3 text-center">
                      {recipientsError}
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchRecipientsData()}
                      className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                    >
                      Prøv igjen
                    </button>
                  </div>
                ) : availableClasses.length === 0 &&
                  availableStudents.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                    <p className="text-center">
                      Ingen klasser eller elever funnet. Sjekk at elevene er
                      opprettet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Class Selector */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                        Legg til klasser
                      </h4>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                        {availableClasses.length === 0 ? (
                          <p className="col-span-2 text-xs text-slate-400 text-center py-2">
                            Ingen klasser funnet
                          </p>
                        ) : (
                          availableClasses.map((cls) => (
                            <label
                              key={cls.id}
                              className={`flex items-center p-2 border rounded cursor-pointer transition-colors ${
                                selectedClasses.has(cls.id)
                                  ? "bg-indigo-50 border-indigo-300"
                                  : "bg-white border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedClasses.has(cls.id)}
                                onChange={() => toggleClass(cls.id)}
                                className="mr-2"
                              />
                              <span className="text-sm font-medium text-slate-900">
                                {cls.name}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Student Selector with Search */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                        Legg til enkeltelever
                      </h4>
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder="Søk etter navn eller klasse..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 bg-white"
                      />
                      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                        {getFilteredStudents().length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">
                            Ingen elever funnet
                          </p>
                        ) : (
                          (() => {
                            // Group students by class
                            const groupedByClass = new Map<
                              string,
                              StudentOption[]
                            >();
                            getFilteredStudents().forEach((stu) => {
                              if (!groupedByClass.has(stu.class_name)) {
                                groupedByClass.set(stu.class_name, []);
                              }
                              groupedByClass.get(stu.class_name)!.push(stu);
                            });

                            return Array.from(groupedByClass.entries()).map(
                              ([className, students]) => {
                                const classStudentCount =
                                  availableStudents.filter(
                                    (s) => s.class_name === className
                                  ).length;
                                const selectedCount = students.filter((s) =>
                                  selectedStudents.has(s.id)
                                ).length;

                                return (
                                  <div
                                    key={className}
                                    className="border-b border-slate-200 last:border-b-0"
                                  >
                                    <div className="sticky top-0 bg-slate-50 px-3 py-2 border-b border-slate-200">
                                      <span className="text-xs font-semibold text-slate-700">
                                        {className} ({selectedCount}/
                                        {classStudentCount})
                                      </span>
                                    </div>
                                    <div className="bg-white">
                                      {students.map((stu) => (
                                        <label
                                          key={stu.id}
                                          id={`student-row-${stu.id}`}
                                          className={`flex items-center p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors last:border-b-0 ${
                                            selectedStudents.has(stu.id)
                                              ? "bg-indigo-50"
                                              : ""
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedStudents.has(
                                              stu.id
                                            )}
                                            onChange={() =>
                                              toggleStudent(stu.id)
                                            }
                                            className="mr-3"
                                          />
                                          <span className="text-sm font-medium text-slate-900">
                                            {stu.name}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                            );
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

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
            </div>
          </div>
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
            onClick={handleCreateTask}
            disabled={!taskForm.title.trim()}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed ${
              selectedCount === 0
                ? "text-indigo-600 bg-white border-2 border-indigo-600 hover:bg-indigo-50"
                : "text-white bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
