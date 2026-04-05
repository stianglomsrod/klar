"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  Users,
  GraduationCap,
  MoreVertical,
  Plus,
} from "lucide-react";
import QueueToggle from "./QueueToggle";
import { getMyActiveQueues } from "@/app/actions/queue-actions";
import HelpRequestQueue from "./HelpRequestQueue";
import BulkStudentAssignModal from "./BulkStudentAssignModal";
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
import type {
  Student,
  Class,
  Trinn,
  OpenMenu,
} from "./classes-accordion/types";
import { groupClassesByTrinn } from "./classes-accordion/class-helpers";
import CreateClassDialog from "./classes-accordion/CreateClassDialog";
import MoveStudentDialog from "./classes-accordion/MoveStudentDialog";
import ContextMenu from "./classes-accordion/ContextMenu";
import StudentRow from "./classes-accordion/StudentRow";

type ClassesAccordionProps = {
  onStudentClick?: (student: Student) => void;
  teacherId?: string;
  searchQuery?: string;
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
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

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

  // ── Multiplayer queue participation state ──────────
  const [activeQueueTargets, setActiveQueueTargets] = useState<Set<string>>(
    new Set(),
  );

  const supabase = createClient();

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
            show_flower_garden,
            custom_welcome_message,
            streak_enabled,
            streak_mode,
            current_streak
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
        custom_welcome_message:
          profile.student_profiles?.custom_welcome_message ?? null,
        streak_enabled: profile.student_profiles?.streak_enabled ?? false,
        streak_mode: profile.student_profiles?.streak_mode ?? "classic",
        current_streak: profile.student_profiles?.current_streak ?? 0,
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

  // Fetch which queues this teacher participates in
  useEffect(() => {
    getMyActiveQueues().then((queues) => {
      setActiveQueueTargets(new Set(queues.map((q) => q.targetId)));
    });
  }, []);

  const handleQueueToggled = (targetId: string, newState: boolean) => {
    setActiveQueueTargets((prev) => {
      const next = new Set(prev);
      if (newState) next.add(targetId);
      else next.delete(targetId);
      return next;
    });
  };

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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center">
          <p className="text-slate-600">Laster klassestruktur...</p>
        </div>
      </div>
    );
  }

  if (filteredTrinnGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8">
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
                            <div className="flex items-center gap-3 ml-3">
                              <QueueToggle
                                targetId={cls.id}
                                targetType="class"
                                isActive={activeQueueTargets.has(cls.id)}
                                onToggled={(val) =>
                                  handleQueueToggled(cls.id, val)
                                }
                              />
                              <button
                                onClick={(e) =>
                                  handleMenuClick(e, "class", cls.id)
                                }
                                className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                                title="More actions"
                              >
                                <MoreVertical className="h-4 w-4 text-slate-600" />
                              </button>
                            </div>
                          </div>

                          {/* Students in this Class */}
                          {isClassExpanded && (
                            <div className="bg-white">
                              {/* Class Toolbar - Bulk Assign */}
                              <div className="w-full px-4 py-3 pl-20 flex items-center gap-4 bg-gray-50 border-b border-slate-200 mb-2">
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
                                  <StudentRow
                                    key={student.id}
                                    student={student}
                                    fallbackClassName={cls.name}
                                    onMenuClick={handleMenuClick}
                                  />
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
        <ContextMenu openMenu={openMenu} onAction={handleMenuAction} />
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
