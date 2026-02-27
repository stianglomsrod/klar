"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  Users,
  GraduationCap,
  MoreVertical,
} from "lucide-react";
import ClassMonitorToggle from "./ClassMonitorToggle";
import HelpRequestQueue from "./HelpRequestQueue";
import type { TeacherStudent } from "@/types/shared";

type Student = TeacherStudent;

type Class = {
  id: string;
  name: string;
  students: Student[];
};

type Trinn = {
  id: string;
  name: string;
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

  const supabase = createClient();

  useEffect(() => {
    fetchClassStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to extract trinn number from class name
  const extractTrinnFromClassName = (className: string): string | null => {
    const match = className.match(/^(\d+)/);
    return match ? match[1] : null;
  };

  // Helper function to group classes by trinn
  const groupClassesByTrinn = (
    classes: { id: string; name: string }[],
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
      .map(([trinnKey, classes]) => ({
        id: trinnKey,
        name: trinnKey === "andre" ? "Andre" : `${trinnKey}. Trinn`,
        classes: classes.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        // "Andre" always goes last
        if (a.id === "andre") return 1;
        if (b.id === "andre") return -1;
        // Sort numerically
        return parseInt(a.id) - parseInt(b.id);
      });

    return trinnArray;
  };

  const fetchClassStructure = async () => {
    setLoading(true);
    try {
      // Fetch all classes
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
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
        // TODO: Implement add class
        break;
      case "edit-trinn":
        // TODO: Implement edit grade
        break;
      case "add-student":
        // TODO: Implement add student
        break;
      case "message-class":
        // TODO: Implement message class
        break;
      case "edit-class":
        // TODO: Implement edit class name
        break;
      case "view-profile":
        router.push(`/teacher/students/${id}`);
        break;
      case "edit-student":
        if (student && onStudentClick) {
          onStudentClick(student);
        }
        break;
      case "move-student":
        // TODO: Implement move student
        break;
      case "remove-student":
        // TODO: Implement remove student
        break;
    }
  };

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
          <p className="text-sm text-slate-500">
            {searchQuery.trim()
              ? "Prøv et annet søkeord"
              : "Opprett klasser for å organisere elevene dine"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900">Mine Klasser</h3>
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
                              {/* Class Toolbar - Monitor Toggle */}
                              <div className="w-full px-4 py-3 pl-20 flex items-center gap-4 bg-gray-50 border-b border-slate-200 mb-2">
                                <ClassMonitorToggle classId={cls.id} />
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
                                        {student.avatar_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={student.avatar_url}
                                            alt={student.full_name}
                                            className="w-full h-full rounded-full object-cover"
                                          />
                                        ) : (
                                          student.full_name
                                            .charAt(0)
                                            .toUpperCase()
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
    </div>
  );
}
