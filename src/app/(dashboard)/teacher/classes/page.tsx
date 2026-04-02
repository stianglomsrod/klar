"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Search, Filter, School, Users } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import StudentTable from "@/components/teacher/StudentTable";
import EditStudentSheet from "@/components/teacher/EditStudentSheet";
import ClassesAccordion from "@/components/teacher/ClassesAccordion";
import type { TeacherStudent } from "@/types/shared";

type Student = TeacherStudent;

function ClassesPageContent() {
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("Alle");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "hierarchy">(
    searchParams.get("tab") === "elever" ? "table" : "hierarchy",
  );
  const [teacherId, setTeacherId] = useState<string>("");

  const supabase = createClient();

  // Get current teacher ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setTeacherId(user.id);
      }
    };
    getCurrentUser();
  }, [supabase.auth]);

  // Fetch students
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
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
            current_streak,
            classes (
              name
            )
          )
          `,
        )
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (error) throw error;

      // Transform data to match Student type
      const transformedData = (data || []).map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        level: profile.student_profiles?.level ?? 1,
        class_id: profile.student_profiles?.class_id ?? null,
        class_name: profile.student_profiles?.classes?.name ?? null,
        show_flower_garden:
          profile.student_profiles?.show_flower_garden ?? true,
        custom_welcome_message:
          profile.student_profiles?.custom_welcome_message ?? null,
        streak_enabled: profile.student_profiles?.streak_enabled ?? false,
        streak_mode: profile.student_profiles?.streak_mode ?? "classic",
        current_streak: profile.student_profiles?.current_streak ?? 0,
      }));

      setStudents(transformedData);
      setFilteredStudents(transformedData);
    } catch {
      // Silent – students list stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter students based on search and class
  useEffect(() => {
    let filtered = students;

    // Filter by class
    if (selectedClass !== "Alle") {
      filtered = filtered.filter(
        (student) => student.class_name === selectedClass,
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter((student) =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    setFilteredStudents(filtered);
  }, [searchQuery, selectedClass, students]);

  // Get unique class names for filter
  const classNames = [
    "Alle",
    ...Array.from(
      new Set(
        students
          .map((s) => s.class_name)
          .filter((name): name is string => name !== null),
      ),
    ),
  ];

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setIsSheetOpen(true);
  };

  // Callback for inline class assignment / removal in StudentTable
  const handleStudentClassChanged = useCallback(
    (studentId: string, className: string | null, classId: string | null) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, class_name: className, class_id: classId }
            : s,
        ),
      );
      if (className) {
        showToast(`Klasse endret til "${className}"`, "success");
      } else {
        showToast("Elev fjernet fra klasse", "success");
      }
    },
    [showToast],
  );

  const handleSaveStudent = async (
    studentId: string,
    updates: {
      show_flower_garden: boolean;
      custom_welcome_message: string | null;
    },
  ) => {
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update(updates)
        .eq("id", studentId);

      if (error) throw error;

      // Update local state
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ...updates } : s)),
      );

      setIsSheetOpen(false);
      setEditingStudent(null);
    } catch {
      showToast("Kunne ikke lagre endringer. Prøv igjen.", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600">Laster elever...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Mine Elever</h1>
        <p className="text-slate-600">
          Administrer elever, klasser og innstillinger
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setViewMode("hierarchy")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === "hierarchy"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <School className="h-4 w-4" />
          Klasser
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === "table"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Users className="h-4 w-4" />
          Elever
        </button>
      </div>

      {/* Global Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={
                viewMode === "hierarchy"
                  ? "Søk etter klasse..."
                  : "Søk etter elev..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Class Filter - only in table view */}
          {viewMode === "table" && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white appearance-none cursor-pointer min-w-[150px]"
              >
                {classNames.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results count - only in table view */}
        {viewMode === "table" && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-sm text-slate-600">
              Viser{" "}
              <span className="font-semibold">{filteredStudents.length}</span>{" "}
              av <span className="font-semibold">{students.length}</span> elever
            </p>
          </div>
        )}
      </div>

      {viewMode === "hierarchy" ? (
        /* Hierarchy View */
        <ClassesAccordion
          teacherId={teacherId}
          searchQuery={searchQuery}
          onStudentClick={(student) => {
            // Find the full student object from our list
            const fullStudent = students.find((s) => s.id === student.id);
            if (fullStudent) {
              handleEditStudent(fullStudent);
            }
          }}
        />
      ) : (
        /* Student Table */
        <StudentTable
          students={filteredStudents}
          onEditStudent={handleEditStudent}
          onStudentClassChanged={handleStudentClassChanged}
        />
      )}

      {/* Edit Student Sheet */}
      {editingStudent && (
        <EditStudentSheet
          student={editingStudent}
          isOpen={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false);
            setEditingStudent(null);
          }}
          onSave={handleSaveStudent}
        />
      )}
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}

export default function ClassesPage() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <ClassesPageContent />
    </Suspense>
  );
}
