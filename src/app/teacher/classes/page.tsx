"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Filter } from "lucide-react";
import StudentTable from "@/components/teacher/StudentTable";
import EditStudentSheet from "@/components/teacher/EditStudentSheet";

type Student = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  show_flower_garden: boolean;
  custom_welcome_message: string | null;
};

export default function ClassesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("Alle");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const supabase = createClient();

  // Fetch students
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, level, class_name, show_flower_garden, custom_welcome_message"
        )
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      console.log("Hentet elever:", data);
      console.log("Feilmelding:", error);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search and class
  useEffect(() => {
    let filtered = students;

    // Filter by class
    if (selectedClass !== "Alle") {
      filtered = filtered.filter(
        (student) => student.class_name === selectedClass
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter((student) =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredStudents(filtered);
  }, [searchQuery, selectedClass, students]);

  // Get unique class names for filter
  const classNames = [
    "Alle",
    ...Array.from(new Set(students.map((s) => s.class_name).filter(Boolean))),
  ];

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setIsSheetOpen(true);
  };

  const handleSaveStudent = async (
    studentId: string,
    updates: {
      show_flower_garden: boolean;
      custom_welcome_message: string | null;
    }
  ) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", studentId);

      if (error) throw error;

      // Update local state
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ...updates } : s))
      );

      setIsSheetOpen(false);
      setEditingStudent(null);
    } catch (error) {
      console.error("Error updating student:", error);
      alert("Kunne ikke lagre endringer. Prøv igjen.");
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

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Søk etter elev..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Class Filter */}
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
        </div>

        {/* Results count */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-sm text-slate-600">
            Viser{" "}
            <span className="font-semibold">{filteredStudents.length}</span> av{" "}
            <span className="font-semibold">{students.length}</span> elever
          </p>
        </div>
      </div>

      {/* Student Table */}
      <StudentTable
        students={filteredStudents}
        onEditStudent={handleEditStudent}
      />

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
    </div>
  );
}
