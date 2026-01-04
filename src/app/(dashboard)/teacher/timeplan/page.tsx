"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import WeeklyScheduleEditor from "@/components/teacher/WeeklyScheduleEditor";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, User, RotateCcw, AlertCircle } from "lucide-react";

type Class = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  full_name: string | null;
  class_id: string;
  class_name: string;
};

export default function TimeplanPage() {
  const getISOWeekNumber = (date: Date): number => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const currentWeek = getISOWeekNumber(new Date());

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [mode, setMode] = useState<"master" | "weekly">("weekly");
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const pendingStudentRef = useRef<Student | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const supabase = createClient();

  const handleModeChange = (nextMode: "master" | "weekly") => {
    setMode(nextMode);
    if (nextMode === "master") {
      setSelectedWeek(0);
    } else {
      setSelectedWeek((prev) => (prev <= 0 ? currentWeek : prev));
    }
  };

  const handleWeekChange = (week: number) => {
    const clamped = Math.max(1, Math.min(53, week));
    setSelectedWeek(clamped);
  };

  const handleClassSelect = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStudentId("");
    setStudentSearch("");
    updateUrlParams(classId, undefined);
  };

  const handleStudentSelect = (student: Student) => {
    pendingStudentRef.current = student;
    ensureClassInList(student.class_id, student.class_name);
    setSelectedClassId(student.class_id);
    setSelectedStudentId(student.id);
    setStudentSearch(student.full_name || "");
    setIsDropdownOpen(false);
    updateUrlParams(student.class_id, student.id);
  };

  const updateUrlParams = (nextClassId?: string, nextStudentId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextClassId) {
      params.set("classId", nextClassId);
    } else {
      params.delete("classId");
    }

    if (nextStudentId) {
      params.set("studentId", nextStudentId);
    } else {
      params.delete("studentId");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      (s.full_name || "").toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  const ensureClassInList = (classId: string, className: string) => {
    if (!classId) return;
    setClasses((prev) => {
      const exists = prev.some((c) => c.id === classId);
      if (exists) return prev;
      return [...prev, { id: classId, name: className || "Ukjent klasse" }];
    });
  };

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, []);

  useEffect(() => {
    const classParam = searchParams.get("classId");
    if (classParam && classParam !== selectedClassId) {
      setSelectedClassId(classParam);
    }

    if (!classParam && !selectedClassId && classes.length > 0) {
      const firstClass = classes[0].id;
      setSelectedClassId(firstClass);
      updateUrlParams(firstClass, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, classes]);

  useEffect(() => {
    const studentParam = searchParams.get("studentId");
    if (!studentParam) {
      if (selectedStudentId) setSelectedStudentId("");
      return;
    }

    if (studentParam === selectedStudentId) return;

    const found = students.find((s) => s.id === studentParam);
    if (found) {
      pendingStudentRef.current = found;
      ensureClassInList(found.class_id, found.class_name);
      setSelectedClassId(found.class_id);
      setSelectedStudentId(found.id);
      setStudentSearch(found.full_name || "");
      return;
    }

    // If student not found yet, keep the id but wait for data to load
    setSelectedStudentId(studentParam);
  }, [searchParams, students, selectedStudentId]);

  useEffect(() => {
    if (!selectedClassId) return;

    if (
      pendingStudentRef.current &&
      pendingStudentRef.current.class_id === selectedClassId
    ) {
      const student = pendingStudentRef.current;
      setSelectedStudentId(student.id);
      setStudentSearch(student.full_name || "");
      pendingStudentRef.current = null;
    } else {
      setSelectedStudentId("");
      setStudentSearch("");
    }

    setIsDropdownOpen(false);
  }, [selectedClassId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");
      if (error) throw error;

      setClasses(data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, student_profiles!inner(class_id, classes(name))"
        )
        .eq("role", "student")
        .order("full_name");

      if (error) throw error;

      const mapped: Student[] = (data || []).map((row) => {
        // Supabase may return the join as a single object or an array; normalize to first entry
        const raw = (row as any).student_profiles;
        const sp = Array.isArray(raw) ? raw[0] : raw || undefined;
        return {
          id: row.id,
          full_name: row.full_name,
          class_id: sp?.class_id || "",
          class_name: sp?.classes?.name || "",
        };
      });

      setStudents(mapped);

      // Ensure any class discovered via student_profiles exists in the dropdown options
      mapped.forEach((s) => ensureClassInList(s.class_id, s.class_name));
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-600 text-sm">Laster inn klasser...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-slate-900 mr-2">
            Timeplan
          </h1>
          {selectedStudentId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Individuell plan:{" "}
              {filteredStudents.find((s) => s.id === selectedStudentId)
                ?.full_name || "Elev"}
            </span>
          )}
        </div>

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
              onChange={(e) => handleClassSelect(e.target.value)}
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
            <label className="text-sm font-medium text-slate-700">
              Søk elev
            </label>
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              {selectedStudentId && (
                <button
                  type="button"
                  onClick={() => {
                    pendingStudentRef.current = null;
                    setSelectedStudentId("");
                    setStudentSearch("");
                    setIsDropdownOpen(false);
                    updateUrlParams(selectedClassId, undefined);
                  }}
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
                  setStudentSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsDropdownOpen(false);
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
                        onClick={() => {
                          handleStudentSelect(student);
                        }}
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
              onClick={() => {
                pendingStudentRef.current = null;
                setSelectedStudentId("");
                setStudentSearch("");
                setIsDropdownOpen(false);
                updateUrlParams(selectedClassId, undefined);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Tilbake til{" "}
              {classes.find((c) => c.id === selectedClassId)?.name || "klassen"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => handleModeChange("master")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              mode === "master"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Fast timeplan
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("weekly")}
            className={`px-4 py-2 text-sm font-semibold border-l border-slate-200 transition-colors ${
              mode === "weekly"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Ukevisning
          </button>
        </div>

        {mode === "weekly" && (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Uke</span>
            <div className="inline-flex items-center rounded-lg border border-slate-200 shadow-sm bg-white">
              <button
                type="button"
                onClick={() => handleWeekChange(selectedWeek - 1)}
                className="px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                aria-label="Forrige uke"
              >
                –
              </button>
              <input
                type="number"
                min={1}
                max={53}
                value={selectedWeek}
                onChange={(e) =>
                  handleWeekChange(parseInt(e.target.value || "1", 10))
                }
                className="w-16 text-center border-l border-r border-slate-200 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleWeekChange(selectedWeek + 1)}
                className="px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                aria-label="Neste uke"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {mode === "master" && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900 mb-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500" />
          <div>
            Du redigerer nå grunnmuren. Endringer her påvirker alle vanlige
            uker.
          </div>
        </div>
      )}

      {selectedClassId && (
        <WeeklyScheduleEditor
          classId={selectedClassId}
          studentId={selectedStudentId || undefined}
          mode={mode}
          externalWeekNumber={selectedWeek}
          onWeekNumberChange={(w) => {
            if (mode === "weekly")
              setSelectedWeek(Math.max(1, Math.min(53, w)));
          }}
          hideWeekSelector
          highlightOverrides={mode === "weekly"}
        />
      )}
    </div>
  );
}
