"use client";

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createClient } from "@/utils/supabase/client";
import type { ClassOption } from "@/types/shared";

type StudentOption = {
  id: string;
  name: string;
  class_id: string;
  class_name: string;
};

export interface RecipientPickerRef {
  /** Returns the de-duplicated list of all selected student IDs (individual + class-based). */
  getSelectedStudentIds: () => string[];
}

export interface RecipientEligibility {
  classId: string | null;
  studentId: string | null;
  studentCount: number;
}

interface RecipientPickerProps {
  initialStudentId?: string | null;
  /** Called whenever eligibility changes (single-class context for schedule). */
  onEligibilityChange: (elig: RecipientEligibility) => void;
}

const RecipientPicker = forwardRef<RecipientPickerRef, RecipientPickerProps>(
  function RecipientPicker({ initialStudentId, onEligibilityChange }, ref) {
    const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
    const [availableStudents, setAvailableStudents] = useState<StudentOption[]>(
      [],
    );
    const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
      new Set(),
    );
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
      () => new Set(initialStudentId ? [initialStudentId] : []),
    );
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    // ----- helpers -----

    const getClassIdForStudent = useCallback(
      (studentId: string) =>
        availableStudents.find((s) => s.id === studentId)?.class_id || null,
      [availableStudents],
    );

    const getSelectedStudentIds = useCallback((): string[] => {
      const uniqueIds = new Set(selectedStudents);
      selectedClasses.forEach((classId) => {
        availableStudents
          .filter((s) => s.class_id === classId)
          .forEach((s) => uniqueIds.add(s.id));
      });
      return Array.from(uniqueIds);
    }, [selectedStudents, selectedClasses, availableStudents]);

    const getFilteredStudents = (): StudentOption[] => {
      if (!studentSearchQuery.trim()) return availableStudents;
      const query = studentSearchQuery.toLowerCase();
      return availableStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.class_name.toLowerCase().includes(query),
      );
    };

    // ----- imperative handle -----

    useImperativeHandle(
      ref,
      () => ({
        getSelectedStudentIds,
      }),
      [getSelectedStudentIds],
    );

    // ----- effects -----

    useEffect(() => {
      fetchRecipientsData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Report eligibility whenever selection changes
    useEffect(() => {
      const classIds = new Set<string>();
      selectedClasses.forEach((cid) => classIds.add(cid));
      selectedStudents.forEach((sid) => {
        const cid = getClassIdForStudent(sid);
        if (cid) classIds.add(cid);
      });

      const totalCount = getSelectedStudentIds().length;

      if (classIds.size !== 1) {
        onEligibilityChange({
          classId: null,
          studentId: null,
          studentCount: totalCount,
        });
      } else {
        const [onlyClassId] = Array.from(classIds);
        const studentId =
          selectedStudents.size === 1 ? Array.from(selectedStudents)[0] : null;
        onEligibilityChange({
          classId: onlyClassId,
          studentId,
          studentCount: totalCount,
        });
      }
    }, [
      selectedClasses,
      selectedStudents,
      getClassIdForStudent,
      getSelectedStudentIds,
      onEligibilityChange,
    ]);

    // Auto-scroll to pre-selected student
    useEffect(() => {
      if (selectedStudents.size > 0 && availableStudents.length > 0) {
        setTimeout(() => {
          const firstSelectedId = Array.from(selectedStudents)[0];
          const row = document.getElementById(`student-row-${firstSelectedId}`);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 200);
      }
      // Only run after data arrives
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableStudents]);

    // ----- data fetching -----

    const fetchRecipientsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
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
          `,
          )
          .order("classes(name)", { ascending: true });

        if (studentsError) throw studentsError;

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
              class_id: classInfo.id,
              class_name: classInfo.name,
            });
          }
        });

        setAvailableClasses(Array.from(uniqueClasses.values()));
        setAvailableStudents(processedStudents);
      } catch {
        setError("Kunne ikke laste elever og klasser. Prøv igjen senere.");
      } finally {
        setIsLoading(false);
      }
    };

    // ----- toggle handlers -----

    const toggleClass = (classId: string) => {
      setSelectedClasses((prev) => {
        const newSet = new Set(prev);
        const isAdding = !newSet.has(classId);

        if (isAdding) {
          newSet.add(classId);
          const studentsInClass = availableStudents
            .filter((s) => s.class_id === classId)
            .map((s) => s.id);
          setSelectedStudents((prevStudents) => {
            const newStudents = new Set(prevStudents);
            studentsInClass.forEach((id) => newStudents.add(id));
            return newStudents;
          });
        } else {
          newSet.delete(classId);
          const studentsInClass = availableStudents
            .filter((s) => s.class_id === classId)
            .map((s) => s.id);
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

    // ----- render -----

    return (
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

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-2"></div>
              Laster elever og klasser...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 mb-3 text-center">{error}</p>
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
                      const groupedByClass = new Map<string, StudentOption[]>();
                      getFilteredStudents().forEach((stu) => {
                        if (!groupedByClass.has(stu.class_name)) {
                          groupedByClass.set(stu.class_name, []);
                        }
                        groupedByClass.get(stu.class_name)!.push(stu);
                      });

                      return Array.from(groupedByClass.entries()).map(
                        ([className, students]) => {
                          const classStudentCount = availableStudents.filter(
                            (s) => s.class_name === className,
                          ).length;
                          const selectedCount = students.filter((s) =>
                            selectedStudents.has(s.id),
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
                                      checked={selectedStudents.has(stu.id)}
                                      onChange={() => toggleStudent(stu.id)}
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
                        },
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default RecipientPicker;
