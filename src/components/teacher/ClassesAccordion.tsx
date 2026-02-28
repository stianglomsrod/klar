"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isImageUrl } from "@/utils/avatar";
import {
  ChevronDown,
  ChevronRight,
  Users,
  GraduationCap,
  MoreVertical,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import ClassMonitorToggle from "./ClassMonitorToggle";
import HelpRequestQueue from "./HelpRequestQueue";
import BulkStudentAssignModal from "./BulkStudentAssignModal";
import ClassCombobox from "./ClassCombobox";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";
import { EditDialog } from "@/components/ui/edit-dialog";
import {
  createClass,
  updateStudentClass,
  renameClass,
  renameGrade,
  deleteClass,
} from "@/app/actions/student-actions";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import type { TeacherStudent } from "@/types/shared";

type Student = TeacherStudent;

type Class = {
  id: string;
  name: string;
  grade_id: string | null;
  students: Student[];
};

type Trinn = {
  id: string;
  name: string;
  grade_id: string | null;
  classes: Class[];
};

type ClassesAccordionProps = {
  onStudentClick?: (student: Student) => void;
  teacherId?: string;
  searchQuery?: string;
};

type DropdownPosition = {
  x: number;
  y: number;
};

export default function ClassesAccordion({
  onStudentClick,
  teacherId = "",
  searchQuery = "",
}: ClassesAccordionProps) {
  const router = useRouter();
  const [trinnGroups, setTrinnGroups] = useState<Trinn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTrinn, setExpandedTrinn] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    new Set(),
  );
  const [openMenu, setOpenMenu] = useState<{
    type: "trinn" | "class" | "student";
    id: string;
    student?: Student;
    position: DropdownPosition;
  } | null>(null);

  // ── Create class dialog state ──────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [createDialogGradeHint, setCreateDialogGradeHint] = useState<
    string | null
  >(null);
  const [creating, setCreating] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // ── Bulk assign modal state ─────────────────────────
  const [bulkAssignTarget, setBulkAssignTarget] = useState<{
    classId: string;
    className: string;
  } | null>(null);

  // ── Confirm dialog state (for "Fjern elev") ────────
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  // ── Move student dialog state ──────────────────────
  const [moveStudentTarget, setMoveStudentTarget] = useState<{
    studentId: string;
    studentName: string;
    currentClassName: string | null;
  } | null>(null);

  // ── Edit class/trinn dialog state ──────────────────
  const [editClassDialog, setEditClassDialog] = useState<{
    classId: string;
    currentName: string;
  } | null>(null);
  const [editClassName, setEditClassName] = useState("");

  const [editTrinnDialog, setEditTrinnDialog] = useState<{
    gradeId: string;
    currentName: string;
  } | null>(null);
  const [editTrinnName, setEditTrinnName] = useState("");

  const supabase = createClient();

  // Helper function to extract trinn number from class name
  const extractTrinnFromClassName = (className: string): string | null => {
    const match = className.match(/^(\d+)/);
    return match ? match[1] : null;
  };

  // Helper function to group classes by trinn
  const groupClassesByTrinn = (
    classes: { id: string; name: string; grade_id: string | null }[],
    students: Student[],
  ): Trinn[] => {
    // Assign students to classes
    const classesWithStudents: Class[] = classes.map((cls) => ({
      ...cls,
      students: students.filter((student) => student.class_id === cls.id),
    }));

    // Group classes by trinn
    const trinnMap = new Map<string, Class[]>();

    classesWithStudents.forEach((cls) => {
      const trinnNumber = extractTrinnFromClassName(cls.name);
      const trinnKey = trinnNumber || "andre";

      if (!trinnMap.has(trinnKey)) {
        trinnMap.set(trinnKey, []);
      }
      trinnMap.get(trinnKey)!.push(cls);
    });

    // Convert map to array and sort
    const trinnArray: Trinn[] = Array.from(trinnMap.entries())
      .map(([trinnKey, classes]) => {
        // Get grade_id from the first class in this group (all share same grade)
        const gradeId = classes[0]?.grade_id ?? null;
        return {
          id: trinnKey,
          name: trinnKey === "andre" ? "Andre" : `${trinnKey}. Trinn`,
          grade_id: gradeId,
          classes: classes.sort((a, b) => a.name.localeCompare(b.name)),
        };
      })
      .sort((a, b) => {
        // "Andre" always goes last
        if (a.id === "andre") return 1;
        if (b.id === "andre") return -1;
        // Sort numerically
        return parseInt(a.id) - parseInt(b.id);
      });

    return trinnArray;
  };

  const fetchClassStructure = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all classes
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name, grade_id")
        .order("name", { ascending: true });

      if (classesError) throw classesError;

      // Fetch all students with their student_profiles and classes
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select(
          `
          id, 
          full_name, 
          avatar_url, 
          student_profiles (
            level,
            class_id,
            show_flower_garden
          )
          `,
        )
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (studentsError) throw studentsError;

      // Transform students data to include class_id from student_profiles
      const transformedStudents = (studentsData || []).map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        level: profile.student_profiles?.level ?? 1,
        show_flower_garden:
          profile.student_profiles?.show_flower_garden ?? true,
        class_id: profile.student_profiles?.class_id ?? null,
        class_name: null, // Will be populated from classes data
      }));

      // Group classes by trinn dynamically
      const trinnGroups = groupClassesByTrinn(
        classesData || [],
        transformedStudents,
      );

      setTrinnGroups(trinnGroups);
    } catch {
      // Silent — class structure fetch failure handled by empty UI
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    fetchClassStructure();
  }, [fetchClassStructure]);

  const toggleTrinn = (trinnId: string) => {
    const newExpanded = new Set(expandedTrinn);
    if (newExpanded.has(trinnId)) {
      newExpanded.delete(trinnId);
    } else {
      newExpanded.add(trinnId);
    }
    setExpandedTrinn(newExpanded);
  };

  const toggleClass = (classId: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId);
    } else {
      newExpanded.add(classId);
    }
    setExpandedClasses(newExpanded);
  };

  const handleMenuClick = (
    e: React.MouseEvent,
    type: "trinn" | "class" | "student",
    id: string,
    student?: Student,
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({
      type,
      id,
      student,
      position: { x: rect.right - 200, y: rect.bottom + 5 },
    });
  };

  const handleMenuAction = (action: string, id: string, student?: Student) => {
    setOpenMenu(null);

    switch (action) {
      case "add-class":
        // Pre-fill grade hint from the trinn context (id = trinn key e.g. "5")
        setCreateDialogGradeHint(id !== "andre" ? `${id}. Trinn` : null);
        setNewClassName(id !== "andre" ? id : "");
        setCreateDialogOpen(true);
        break;
      case "edit-trinn": {
        // Find the trinn to get its grade_id
        const trinn = trinnGroups.find((t) => t.id === id);
        if (trinn && trinn.grade_id) {
          setEditTrinnDialog({
            gradeId: trinn.grade_id,
            currentName: trinn.name,
          });
          setEditTrinnName(trinn.name);
        } else {
          showToast("Kan ikke redigere dette trinnet.", "error");
        }
        break;
      }
      case "add-student": {
        // Find the class info for the bulk assign modal
        const targetClass = trinnGroups
          .flatMap((t) => t.classes)
          .find((c) => c.id === id);
        if (targetClass) {
          setBulkAssignTarget({
            classId: targetClass.id,
            className: targetClass.name,
          });
        }
        break;
      }
      case "message-class":
        // TODO: Implement message class
        break;
      case "edit-class": {
        // Find the class by id
        const classToEdit = trinnGroups
          .flatMap((t) => t.classes)
          .find((c) => c.id === id);
        if (classToEdit) {
          setEditClassDialog({
            classId: classToEdit.id,
            currentName: classToEdit.name,
          });
          setEditClassName(classToEdit.name);
        }
        break;
      }
      case "delete-class": {
        const classToDelete = trinnGroups
          .flatMap((t) => t.classes)
          .find((c) => c.id === id);
        if (classToDelete) {
          if (classToDelete.students.length > 0) {
            showToast(
              `Kan ikke slette "${classToDelete.name}" — den har ${classToDelete.students.length} elev${classToDelete.students.length !== 1 ? "er" : ""}.`,
              "error",
            );
          } else {
            setConfirmDialog({
              title: "Slett klasse",
              description: `Er du sikker på at du vil slette klassen "${classToDelete.name}"? Denne handlingen kan ikke angres.`,
              action: async () => {
                const result = await deleteClass(classToDelete.id);
                if (result.success) {
                  showToast(
                    `Klassen "${classToDelete.name}" er slettet.`,
                    "success",
                  );
                  fetchClassStructure();
                } else {
                  showToast(result.error, "error");
                }
              },
            });
          }
        }
        break;
      }
      case "view-profile":
        router.push(`/teacher/students/${id}`);
        break;
      case "edit-student":
        if (student && onStudentClick) {
          onStudentClick(student);
        }
        break;
      case "move-student": {
        // Find student info for ClassCombobox dialog
        const studentToMove = trinnGroups
          .flatMap((t) => t.classes)
          .flatMap((c) => c.students)
          .find((s) => s.id === id);
        if (studentToMove) {
          setMoveStudentTarget({
            studentId: studentToMove.id,
            studentName: studentToMove.full_name,
            currentClassName: studentToMove.class_name || null,
          });
        }
        break;
      }
      case "remove-student": {
        // Find student info for the confirm dialog
        const studentToRemove = trinnGroups
          .flatMap((t) => t.classes)
          .flatMap((c) => c.students)
          .find((s) => s.id === id);
        if (studentToRemove) {
          const className =
            studentToRemove.class_name ||
            trinnGroups
              .flatMap((t) => t.classes)
              .find((c) => c.students.some((s) => s.id === id))?.name ||
            "klassen";
          setConfirmDialog({
            title: "Fjern elev fra klasse",
            description: `Er du sikker på at du vil fjerne ${studentToRemove.full_name} fra ${className}?`,
            action: async () => {
              const result = await updateStudentClass(id, null, null);
              if (result.success) {
                showToast(
                  `${studentToRemove.full_name} fjernet fra klassen`,
                  "success",
                );
                fetchClassStructure();
              } else {
                showToast(result.error, "error");
              }
            },
          });
        }
        break;
      }
    }
  };

  // ── Create class handler ───────────────────────────
  const openCreateDialog = useCallback((gradeHint?: string | null) => {
    setCreateDialogGradeHint(gradeHint ?? null);
    setNewClassName(
      gradeHint && gradeHint !== "Annet"
        ? gradeHint.replace(/\.\s*Trinn$/i, "")
        : "",
    );
    setCreateDialogOpen(true);
  }, []);

  const handleCreateClassSubmit = useCallback(async () => {
    const name = newClassName.trim();
    if (!name) return;

    setCreating(true);
    const result = await createClass(name, createDialogGradeHint ?? undefined);
    setCreating(false);

    if (result.success) {
      showToast(`Klasse "${result.name}" opprettet`, "success");
      setCreateDialogOpen(false);
      setNewClassName("");
      setCreateDialogGradeHint(null);
      fetchClassStructure();
    } else {
      showToast(result.error, "error");
    }
  }, [newClassName, createDialogGradeHint, showToast, fetchClassStructure]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null);
    if (openMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenu]);

  // Filter trinn/classes based on search query
  const filteredTrinnGroups = searchQuery.trim()
    ? trinnGroups
        .map((trinn) => {
          const q = searchQuery.toLowerCase();
          // Check if trinn name matches
          const trinnMatches = trinn.name.toLowerCase().includes(q);
          if (trinnMatches) return trinn;
          // Otherwise filter to classes whose name matches or have matching students
          const filteredClasses = trinn.classes
            .map((cls) => {
              const classMatches = cls.name.toLowerCase().includes(q);
              if (classMatches) return cls;
              const filteredStudents = cls.students.filter((s) =>
                s.full_name.toLowerCase().includes(q),
              );
              if (filteredStudents.length > 0)
                return { ...cls, students: filteredStudents };
              return null;
            })
            .filter((cls): cls is Class => cls !== null);
          if (filteredClasses.length > 0)
            return { ...trinn, classes: filteredClasses };
          return null;
        })
        .filter((trinn): trinn is Trinn => trinn !== null)
    : trinnGroups;

  // Auto-expand trinn/classes when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const expandedT = new Set<string>();
      const expandedC = new Set<string>();
      filteredTrinnGroups.forEach((trinn) => {
        expandedT.add(trinn.id);
        trinn.classes.forEach((cls) => expandedC.add(cls.id));
      });
      setExpandedTrinn(expandedT);
      setExpandedClasses(expandedC);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-center">
          <p className="text-slate-600">Laster klassestruktur...</p>
        </div>
      </div>
    );
  }

  if (filteredTrinnGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-2">
            {searchQuery.trim() ? "Ingen treff" : "Ingen klassestruktur funnet"}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            {searchQuery.trim()
              ? "Prøv et annet søkeord"
              : "Opprett klasser for å organisere elevene dine"}
          </p>
          {!searchQuery.trim() && (
            <button
              onClick={() => openCreateDialog()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Opprett klasse
            </button>
          )}
        </div>
        {/* Create Class Dialog */}
        {createDialogOpen && (
          <CreateClassDialog
            newClassName={newClassName}
            setNewClassName={setNewClassName}
            gradeHint={createDialogGradeHint}
            creating={creating}
            onSubmit={handleCreateClassSubmit}
            onClose={() => {
              setCreateDialogOpen(false);
              setNewClassName("");
              setCreateDialogGradeHint(null);
            }}
          />
        )}
        <Toast toast={toast} onClose={hideToast} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Mine Klasser</h3>
        <button
          onClick={() => openCreateDialog()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="Legg til klasse"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Legg til klasse</span>
        </button>
      </div>

      <div className="divide-y divide-slate-200">
        {filteredTrinnGroups.map((trinn) => {
          const isTrinnExpanded = expandedTrinn.has(trinn.id);
          const totalStudents = trinn.classes.reduce(
            (sum, cls) => sum + cls.students.length,
            0,
          );

          return (
            <div key={trinn.id}>
              {/* Trinn Header */}
              <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <button
                  onClick={() => toggleTrinn(trinn.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  {isTrinnExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                  <GraduationCap className="h-5 w-5 text-indigo-600" />
                  <span className="font-semibold text-slate-900">
                    {trinn.name}
                  </span>
                  <span className="ml-auto text-sm text-slate-600">
                    {totalStudents} elever
                  </span>
                </button>
                <button
                  onClick={(e) => handleMenuClick(e, "trinn", trinn.id)}
                  className="ml-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="h-4 w-4 text-slate-600" />
                </button>
              </div>

              {/* Classes in this Trinn */}
              {isTrinnExpanded && (
                <div className="bg-slate-50">
                  {trinn.classes.length === 0 ? (
                    <div className="px-4 py-3 pl-12 text-sm text-slate-500">
                      Ingen klasser i dette trinnet
                    </div>
                  ) : (
                    trinn.classes.map((cls) => {
                      const isClassExpanded = expandedClasses.has(cls.id);

                      return (
                        <div key={cls.id}>
                          {/* Class Header */}
                          <div className="w-full px-4 py-2 pl-12 flex items-center justify-between hover:bg-slate-100 transition-colors">
                            <button
                              onClick={() => toggleClass(cls.id)}
                              className="flex-1 flex items-center gap-3 text-left"
                            >
                              {isClassExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                              <Users className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-slate-900">
                                {cls.name}
                              </span>
                              <span className="ml-auto text-sm text-slate-600">
                                {cls.students.length} elever
                              </span>
                            </button>
                            <button
                              onClick={(e) =>
                                handleMenuClick(e, "class", cls.id)
                              }
                              className="ml-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                              title="More actions"
                            >
                              <MoreVertical className="h-4 w-4 text-slate-600" />
                            </button>
                          </div>

                          {/* Students in this Class */}
                          {isClassExpanded && (
                            <div className="bg-white">
                              {/* Class Toolbar - Monitor Toggle + Bulk Assign */}
                              <div className="w-full px-4 py-3 pl-20 flex items-center gap-4 bg-gray-50 border-b border-slate-200 mb-2">
                                <ClassMonitorToggle classId={cls.id} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBulkAssignTarget({
                                      classId: cls.id,
                                      className: cls.name,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                                  title="Legg til elever i denne klassen"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Legg til elever
                                </button>
                              </div>

                              {/* Help Request Queue */}
                              <HelpRequestQueue classId={cls.id} />

                              {cls.students.length === 0 ? (
                                <div className="px-4 py-3 pl-20 text-sm text-slate-500">
                                  Ingen elever i denne klassen
                                </div>
                              ) : (
                                cls.students.map((student) => (
                                  <div
                                    key={student.id}
                                    className="w-full px-4 py-2 pl-20 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                                  >
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/teacher/students/${student.id}`,
                                        )
                                      }
                                      className="flex-1 flex items-center gap-3 text-left"
                                    >
                                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xs flex-shrink-0">
                                        {isImageUrl(student.avatar_url) ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={student.avatar_url}
                                            alt={student.full_name}
                                            className="w-full h-full rounded-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-base">
                                            {student.avatar_url ||
                                              student.full_name
                                                .charAt(0)
                                                .toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                          {student.full_name}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                            {student.class_name || cls.name}
                                          </span>
                                          <span>•</span>
                                          <span>Nivå {student.level}</span>
                                          <span>•</span>
                                          <span>
                                            {student.show_flower_garden
                                              ? "🌱 Hage"
                                              : "🏆 Poeng"}
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMenuClick(
                                          e,
                                          "student",
                                          student.id,
                                          student,
                                        );
                                      }}
                                      className="ml-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                                      title="More actions"
                                    >
                                      <MoreVertical className="h-4 w-4 text-slate-600" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu Dropdown */}
      {openMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]"
          style={{ top: openMenu.position.y, left: openMenu.position.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {openMenu.type === "trinn" && (
            <>
              <button
                onClick={() => handleMenuAction("add-class", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Legg til klasse
              </button>
              <button
                onClick={() => handleMenuAction("edit-trinn", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Rediger trinn
              </button>
            </>
          )}

          {openMenu.type === "class" && (
            <>
              <button
                onClick={() => handleMenuAction("add-student", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Legg til elev
              </button>
              <button
                onClick={() => handleMenuAction("message-class", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Send melding til klasse
              </button>
              <button
                onClick={() => handleMenuAction("edit-class", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Rediger klassenavn
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onClick={() => handleMenuAction("delete-class", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Slett klasse
              </button>
            </>
          )}

          {openMenu.type === "student" && (
            <>
              <button
                onClick={() => handleMenuAction("view-profile", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Se profil
              </button>
              <button
                onClick={() =>
                  handleMenuAction(
                    "edit-student",
                    openMenu.id,
                    openMenu.student,
                  )
                }
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Rediger
              </button>
              <button
                onClick={() => handleMenuAction("move-student", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Flytt elev
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onClick={() => handleMenuAction("remove-student", openMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Fjern elev
              </button>
            </>
          )}
        </div>
      )}

      {/* Create Class Dialog */}
      {createDialogOpen && (
        <CreateClassDialog
          newClassName={newClassName}
          setNewClassName={setNewClassName}
          gradeHint={createDialogGradeHint}
          creating={creating}
          onSubmit={handleCreateClassSubmit}
          onClose={() => {
            setCreateDialogOpen(false);
            setNewClassName("");
            setCreateDialogGradeHint(null);
          }}
        />
      )}
      {/* Bulk Student Assign Modal */}
      {bulkAssignTarget && (
        <BulkStudentAssignModal
          targetClassId={bulkAssignTarget.classId}
          targetClassName={bulkAssignTarget.className}
          onComplete={() => {
            showToast(
              `Elever lagt til i ${bulkAssignTarget.className}`,
              "success",
            );
            fetchClassStructure();
          }}
          onClose={() => setBulkAssignTarget(null)}
        />
      )}

      {/* Move Student Dialog */}
      {moveStudentTarget && (
        <MoveStudentDialog
          studentId={moveStudentTarget.studentId}
          studentName={moveStudentTarget.studentName}
          currentClassName={moveStudentTarget.currentClassName}
          onMoved={(newClassName) => {
            showToast(
              `${moveStudentTarget.studentName} flyttet til ${newClassName}`,
              "success",
            );
            setMoveStudentTarget(null);
            fetchClassStructure();
          }}
          onClose={() => setMoveStudentTarget(null)}
        />
      )}

      {/* Confirm Dialog (remove student / delete class) */}
      <ConfirmDialog
        state={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        confirmLabel="Fjern"
      />

      {/* Edit Class Name Dialog */}
      <EditDialog
        open={!!editClassDialog}
        onClose={() => setEditClassDialog(null)}
        title="Rediger klassenavn"
        onSave={async () => {
          if (!editClassDialog) return;
          const result = await renameClass(
            editClassDialog.classId,
            editClassName,
          );
          if (result.success) {
            showToast(
              `Klassenavn endret til "${editClassName.trim()}"`,
              "success",
            );
            setEditClassDialog(null);
            fetchClassStructure();
          } else {
            showToast(result.error, "error");
          }
        }}
      >
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Nytt klassenavn
          </label>
          <input
            type="text"
            value={editClassName}
            onChange={(e) => setEditClassName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && editClassName.trim()) {
                e.preventDefault();
                // Trigger save via form submission pattern
                const saveBtn = (e.target as HTMLElement)
                  .closest(".max-h-\\[90vh\\]")
                  ?.querySelector(
                    "button:last-child",
                  ) as HTMLButtonElement | null;
                saveBtn?.click();
              }
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </EditDialog>

      {/* Edit Trinn Name Dialog */}
      <EditDialog
        open={!!editTrinnDialog}
        onClose={() => setEditTrinnDialog(null)}
        title="Rediger trinnnavn"
        onSave={async () => {
          if (!editTrinnDialog) return;
          const result = await renameGrade(
            editTrinnDialog.gradeId,
            editTrinnName,
          );
          if (result.success) {
            showToast(
              `Trinnnavn endret til "${editTrinnName.trim()}"`,
              "success",
            );
            setEditTrinnDialog(null);
            fetchClassStructure();
          } else {
            showToast(result.error, "error");
          }
        }}
      >
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Nytt trinnnavn
          </label>
          <input
            type="text"
            value={editTrinnName}
            onChange={(e) => setEditTrinnName(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </EditDialog>

      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}

// ── Move Student Dialog ──────────────────────────────

function MoveStudentDialog({
  studentId,
  studentName,
  currentClassName,
  onMoved,
  onClose,
}: {
  studentId: string;
  studentName: string;
  currentClassName: string | null;
  onMoved: (newClassName: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Flytt {studentName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {currentClassName && (
          <p className="text-sm text-slate-500 mb-3">
            Nåværende klasse:{" "}
            <span className="font-medium text-slate-700">
              {currentClassName}
            </span>
          </p>
        )}

        <p className="text-sm text-slate-600 mb-3">Velg ny klasse:</p>

        <ClassCombobox
          studentId={studentId}
          initialClassName={currentClassName}
          onClassChanged={(newClassName) => {
            onMoved(newClassName);
          }}
        />
      </div>
    </div>
  );
}

// ── Create Class Dialog ──────────────────────────────

function inferGradeFromInput(className: string): string {
  const match = className.match(/^(\d+)/);
  return match ? `${match[1]}. Trinn` : "Annet";
}

function CreateClassDialog({
  newClassName,
  setNewClassName,
  gradeHint,
  creating,
  onSubmit,
  onClose,
}: {
  newClassName: string;
  setNewClassName: (v: string) => void;
  gradeHint: string | null;
  creating: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const displayedGrade = gradeHint || inferGradeFromInput(newClassName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            Opprett klasse
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Klassenavn
            </label>
            <input
              type="text"
              placeholder='F.eks. "5A", "6B"'
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newClassName.trim()) onSubmit();
              }}
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {newClassName.trim() && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
              Trinn:{" "}
              <span className="font-medium text-slate-900">
                {displayedGrade}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={onSubmit}
            disabled={!newClassName.trim() || creating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Opprett
          </button>
        </div>
      </div>
    </div>
  );
}
