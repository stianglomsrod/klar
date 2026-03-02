"use client";

import { Search, X, User, RotateCcw } from "lucide-react";
import type { Class, Student } from "./useClassStudentSelection";

// ── Props ──

type ClassStudentSelectorProps = {
  classes: Class[];
  selectedClassId: string;
  onClassSelect: (classId: string) => void;

  studentSearch: string;
  onStudentSearchChange: (value: string) => void;
  selectedStudentId: string;
  filteredStudents: Student[];
  isDropdownOpen: boolean;
  onDropdownOpenChange: (open: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onStudentSelect: (student: Student) => void;
  onClearStudent: () => void;
};

// ── Component ──

export default function ClassStudentSelector({
  classes,
  selectedClassId,
  onClassSelect,
  studentSearch,
  onStudentSearchChange,
  selectedStudentId,
  filteredStudents,
  isDropdownOpen,
  onDropdownOpenChange,
  dropdownRef,
  onStudentSelect,
  onClearStudent,
}: ClassStudentSelectorProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" ref={dropdownRef}>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="class-select"
          className="text-sm font-medium text-slate-700"
        >
          Velg klasse
        </label>
        <select
          id="class-select"
          value={selectedClassId}
          onChange={(e) => onClassSelect(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium w-[160px]"
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Søk elev</label>
        <div className="relative w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          {selectedStudentId && (
            <button
              type="button"
              onClick={onClearStudent}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <input
            type="text"
            value={studentSearch}
            onChange={(e) => {
              onStudentSearchChange(e.target.value);
              onDropdownOpenChange(true);
            }}
            onFocus={() => onDropdownOpenChange(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onDropdownOpenChange(false);
            }}
            placeholder="Skriv navn..."
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          {isDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {filteredStudents.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-500">
                  Ingen elever funnet
                </div>
              )}
              {filteredStudents.map((student) => {
                const active = selectedStudentId === student.id;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => onStudentSelect(student)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-800"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    <span className="truncate">
                      {student.full_name || "Uten navn"}
                      {student.class_name ? ` (${student.class_name})` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedStudentId && (
        <button
          type="button"
          onClick={onClearStudent}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100"
        >
          <RotateCcw className="h-4 w-4" />
          Tilbake til{" "}
          {classes.find((c) => c.id === selectedClassId)?.name || "klassen"}
        </button>
      )}
    </div>
  );
}
