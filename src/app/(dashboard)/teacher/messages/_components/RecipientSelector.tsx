"use client";

import { useState, useMemo } from "react";
import { Plus, X, Search, ChevronRight, ChevronDown } from "lucide-react";

export type Recipient = {
  type: "grade" | "class" | "student";
  id: string;
  label: string;
};

type Grade = {
  id: string;
  name: string;
};

type Class = {
  id: string;
  name: string;
  grade_id: string;
};

type Student = {
  id: string;
  name: string;
  class_id: string;
};

interface RecipientSelectorProps {
  data: {
    grades: Grade[];
    classes: Class[];
    students: Student[];
  };
  selectedRecipients: Recipient[];
  onSelect: (recipients: Recipient[]) => void;
}

export function RecipientSelector({
  data,
  selectedRecipients,
  onSelect,
}: RecipientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const selectedIds = useMemo(
    () => new Set(selectedRecipients.map((r) => `${r.type}:${r.id}`)),
    [selectedRecipients],
  );

  // Toggle expansion of grades/classes
  const toggleExpansion = (type: "grade" | "class", id: string) => {
    const key = `${type}:${id}`;
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedNodes(newExpanded);
  };

  const isExpanded = (type: "grade" | "class", id: string) => {
    return expandedNodes.has(`${type}:${id}`);
  };

  // Build hierarchical data structure
  const hierarchicalData = useMemo(() => {
    // If no grades exist, create virtual grades from classes
    let gradesToUse = data.grades;

    if (data.grades.length === 0 && data.classes.length > 0) {
      // Extract unique grade_ids from classes and create placeholder grades
      const uniqueGradeIds = [
        ...new Set(data.classes.map((c) => c.grade_id).filter(Boolean)),
      ];

      if (uniqueGradeIds.length > 0) {
        // Create placeholder grades based on class grade_ids
        gradesToUse = uniqueGradeIds.map((gradeId, index) => ({
          id: gradeId,
          name: `Trinn ${index + 1}`, // Placeholder name
        }));
      } else {
        // No grade_ids at all - create one "ungrouped" grade containing all classes
        gradesToUse = [
          {
            id: "ungrouped",
            name: "Alle klasser",
          },
        ];
      }
    }

    const sortedGrades = [...gradesToUse].sort((a, b) =>
      a.name.localeCompare(b.name, "no", { numeric: true }),
    );

    const result = sortedGrades.map((grade) => {
      // For "ungrouped", include all classes; otherwise filter by grade_id
      const classesInGrade =
        grade.id === "ungrouped"
          ? data.classes
          : data.classes.filter((c) => c.grade_id === grade.id);

      const sortedClasses = classesInGrade.sort((a, b) =>
        a.name.localeCompare(b.name, "no"),
      );

      const classesWithStudents = sortedClasses.map((cls) => {
        const studentsInClass = data.students
          .filter((s) => s.class_id === cls.id)
          .sort((a, b) => a.name.localeCompare(b.name, "no"));

        return {
          ...cls,
          students: studentsInClass,
        };
      });

      return {
        ...grade,
        classes: classesWithStudents,
      };
    });

    return result;
  }, [data]);

  // Filter based on search query
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery) return hierarchicalData;

    const query = searchQuery.toLowerCase();
    return hierarchicalData
      .map((grade) => {
        const gradeMatches = grade.name.toLowerCase().includes(query);

        const filteredClasses = grade.classes
          .map((cls) => {
            const classMatches = cls.name.toLowerCase().includes(query);
            const filteredStudents = cls.students.filter((s) =>
              s.name.toLowerCase().includes(query),
            );

            // Include class if: class name matches, OR has matching students
            if (classMatches || filteredStudents.length > 0) {
              return { ...cls, students: filteredStudents };
            }
            return null;
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        // Include grade if: grade name matches, OR has matching classes
        if (gradeMatches || filteredClasses.length > 0) {
          return { ...grade, classes: filteredClasses };
        }
        return null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [hierarchicalData, searchQuery]);

  const toggleRecipient = (
    type: "grade" | "class" | "student",
    id: string,
    label: string,
  ) => {
    const key = `${type}:${id}`;
    const isCurrentlySelected = selectedIds.has(key);

    let newRecipients = [...selectedRecipients];

    if (isCurrentlySelected) {
      // DESELECTION LOGIC
      if (type === "grade") {
        // Remove grade, all its classes, and all students in those classes
        const classesInGrade = data.classes.filter((c) => c.grade_id === id);
        const classIds = classesInGrade.map((c) => c.id);
        const studentIds = data.students
          .filter((s) => classIds.includes(s.class_id))
          .map((s) => s.id);

        newRecipients = newRecipients.filter(
          (r) =>
            !(
              (r.type === "grade" && r.id === id) ||
              (r.type === "class" && classIds.includes(r.id)) ||
              (r.type === "student" && studentIds.includes(r.id))
            ),
        );
      } else if (type === "class") {
        // Remove class, all its students, AND the grade if selected
        const cls = data.classes.find((c) => c.id === id);
        const studentIds = data.students
          .filter((s) => s.class_id === id)
          .map((s) => s.id);

        newRecipients = newRecipients.filter(
          (r) =>
            !(
              (r.type === "class" && r.id === id) ||
              (r.type === "student" && studentIds.includes(r.id)) ||
              (r.type === "grade" && r.id === cls?.grade_id)
            ),
        );
      } else if (type === "student") {
        // Remove student, AND remove its class and grade if they were selected
        const student = data.students.find((s) => s.id === id);
        const cls = data.classes.find((c) => c.id === student?.class_id);

        newRecipients = newRecipients.filter(
          (r) =>
            !(
              (r.type === "student" && r.id === id) ||
              (r.type === "class" && r.id === student?.class_id) ||
              (r.type === "grade" && r.id === cls?.grade_id)
            ),
        );
      }
    } else {
      // SELECTION LOGIC
      if (type === "grade") {
        // Add grade, all its classes, and all students in those classes
        const classesInGrade = data.classes.filter((c) => c.grade_id === id);
        const studentsInGrade = data.students.filter((s) =>
          classesInGrade.some((c) => c.id === s.class_id),
        );

        newRecipients.push({ type: "grade", id, label });
        classesInGrade.forEach((cls) => {
          if (!selectedIds.has(`class:${cls.id}`)) {
            newRecipients.push({ type: "class", id: cls.id, label: cls.name });
          }
        });
        studentsInGrade.forEach((student) => {
          if (!selectedIds.has(`student:${student.id}`)) {
            newRecipients.push({
              type: "student",
              id: student.id,
              label: student.name,
            });
          }
        });
      } else if (type === "class") {
        // Add class and all its students
        const studentsInClass = data.students.filter((s) => s.class_id === id);

        newRecipients.push({ type: "class", id, label });
        studentsInClass.forEach((student) => {
          if (!selectedIds.has(`student:${student.id}`)) {
            newRecipients.push({
              type: "student",
              id: student.id,
              label: student.name,
            });
          }
        });
      } else if (type === "student") {
        // Just add the student
        newRecipients.push({ type: "student", id, label });
      }
    }

    onSelect(newRecipients);
  };

  const removeRecipient = (type: string, id: string) => {
    // Use the same cascading logic as toggleRecipient
    const recipient = selectedRecipients.find(
      (r) => r.type === type && r.id === id,
    );
    if (recipient) {
      toggleRecipient(
        recipient.type as "grade" | "class" | "student",
        recipient.id,
        recipient.label,
      );
    }
  };

  const isChecked = (type: string, id: string) => {
    return selectedIds.has(`${type}:${id}`);
  };

  return (
    <div className="space-y-3">
      {/* Selected Recipients Tags */}
      {selectedRecipients.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {selectedRecipients.map((recipient) => (
            <div
              key={`${recipient.type}:${recipient.id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
            >
              <span>{recipient.label}</span>
              <button
                onClick={() => removeRecipient(recipient.type, recipient.id)}
                className="hover:text-indigo-900 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-slate-700 font-medium"
      >
        <Plus className="h-4 w-4" />
        {selectedRecipients.length === 0
          ? "Legg til mottakere"
          : `${selectedRecipients.length} valgt`}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-3 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Velg mottakere
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Søk etter navn, klasse eller trinn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable List - Hierarchical Accordion */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredHierarchy.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">
                    Ingen resultater for &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredHierarchy.map((grade) => {
                    const gradeExpanded = isExpanded("grade", grade.id);
                    const hasClasses =
                      grade.classes && grade.classes.length > 0;

                    return (
                      <div key={`grade:${grade.id}`}>
                        {/* Grade Row */}
                        <div className="flex items-center gap-1 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                          {/* Chevron Button - Always Render for Testing */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleExpansion("grade", grade.id);
                            }}
                            className="w-6 h-6 p-0 flex items-center justify-center hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                          >
                            {gradeExpanded ? (
                              <ChevronDown
                                className="h-5 w-5 text-slate-700"
                                strokeWidth={3}
                              />
                            ) : (
                              <ChevronRight
                                className="h-5 w-5 text-slate-700"
                                strokeWidth={3}
                              />
                            )}
                          </button>

                          {/* Checkbox */}
                          <label className="flex items-center gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked("grade", grade.id)}
                              onChange={() =>
                                toggleRecipient("grade", grade.id, grade.name)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-900 font-bold">
                              {grade.name}
                            </span>
                          </label>
                        </div>

                        {/* Classes (nested under Grade) */}
                        {gradeExpanded &&
                          hasClasses &&
                          grade.classes.map((cls) => {
                            const classExpanded = isExpanded("class", cls.id);
                            const hasStudents =
                              cls.students && cls.students.length > 0;

                            return (
                              <div key={`class:${cls.id}`}>
                                {/* Class Row */}
                                <div className="flex items-center gap-1 p-2 pl-0 hover:bg-slate-100 rounded-lg transition-colors ml-6">
                                  {/* Chevron Button - Always Render for Testing */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleExpansion("class", cls.id);
                                    }}
                                    className="w-6 h-6 p-0 flex items-center justify-center hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                                  >
                                    {classExpanded ? (
                                      <ChevronDown
                                        className="h-5 w-5 text-slate-700"
                                        strokeWidth={3}
                                      />
                                    ) : (
                                      <ChevronRight
                                        className="h-5 w-5 text-slate-700"
                                        strokeWidth={3}
                                      />
                                    )}
                                  </button>

                                  {/* Checkbox */}
                                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked("class", cls.id)}
                                      onChange={() =>
                                        toggleRecipient(
                                          "class",
                                          cls.id,
                                          cls.name,
                                        )
                                      }
                                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-900 font-semibold">
                                      {cls.name}
                                    </span>
                                  </label>
                                </div>

                                {/* Students (nested under Class) */}
                                {classExpanded &&
                                  hasStudents &&
                                  cls.students.map((student) => (
                                    <div
                                      key={`student:${student.id}`}
                                      className="flex items-center gap-0 p-2 pl-0 hover:bg-slate-100 rounded-lg transition-colors ml-12"
                                    >
                                      {/* Empty space for alignment */}
                                      <div className="w-6 h-6 flex-shrink-0" />

                                      {/* Checkbox */}
                                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isChecked(
                                            "student",
                                            student.id,
                                          )}
                                          onChange={() =>
                                            toggleRecipient(
                                              "student",
                                              student.id,
                                              student.name,
                                            )
                                          }
                                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-slate-900">
                                          {student.name}
                                        </span>
                                      </label>
                                    </div>
                                  ))}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <p className="text-sm text-slate-600 font-medium">
                {selectedRecipients.length} valgt
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Ferdig
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
