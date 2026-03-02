import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getISOWeekNumber } from "@/utils/week-number";

// ── Types ──

type Class = { id: string; name: string };

type Student = {
  id: string;
  full_name: string | null;
  class_id: string;
  class_name: string;
};

export type { Class, Student };

// ── Hook ──

export function useClassStudentSelection() {
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

  // ── Derived ──

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      (s.full_name || "").toLowerCase().includes(term),
    );
  }, [students, studentSearch]);

  const selectedClassName =
    classes.find((c) => c.id === selectedClassId)?.name || "";

  // ── URL helpers ──

  const updateUrlParams = useCallback(
    (nextClassId?: string, nextStudentId?: string) => {
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
    },
    [searchParams, router, pathname],
  );

  // ── Helpers ──

  const ensureClassInList = useCallback(
    (classId: string, className: string) => {
      if (!classId) return;
      setClasses((prev) => {
        const exists = prev.some((c) => c.id === classId);
        if (exists) return prev;
        return [...prev, { id: classId, name: className || "Ukjent klasse" }];
      });
    },
    [],
  );

  // ── Handlers ──

  const handleModeChange = useCallback(
    (nextMode: "master" | "weekly") => {
      setMode(nextMode);
      if (nextMode === "master") {
        setSelectedWeek(0);
      } else {
        setSelectedWeek((prev) => (prev <= 0 ? currentWeek : prev));
      }
    },
    [currentWeek],
  );

  const handleWeekChange = useCallback((week: number) => {
    const clamped = Math.max(1, Math.min(53, week));
    setSelectedWeek(clamped);
  }, []);

  const handleClassSelect = useCallback(
    (classId: string) => {
      setSelectedClassId(classId);
      setSelectedStudentId("");
      setStudentSearch("");
      updateUrlParams(classId, undefined);
    },
    [updateUrlParams],
  );

  const handleStudentSelect = useCallback(
    (student: Student) => {
      pendingStudentRef.current = student;
      ensureClassInList(student.class_id, student.class_name);
      setSelectedClassId(student.class_id);
      setSelectedStudentId(student.id);
      setStudentSearch(student.full_name || "");
      setIsDropdownOpen(false);
      updateUrlParams(student.class_id, student.id);
    },
    [ensureClassInList, updateUrlParams],
  );

  const clearStudentSelection = useCallback(() => {
    pendingStudentRef.current = null;
    setSelectedStudentId("");
    setStudentSearch("");
    setIsDropdownOpen(false);
    updateUrlParams(selectedClassId, undefined);
  }, [selectedClassId, updateUrlParams]);

  // ── Fetch data ──

  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");
      if (error) throw error;
      setClasses(data || []);
    } catch {
      // Silent – classes list stays empty
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchStudents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, student_profiles!inner(class_id, classes(name))",
        )
        .eq("role", "student")
        .order("full_name");

      if (error) throw error;

      const mapped: Student[] = (data || []).map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      mapped.forEach((s) => ensureClassInList(s.class_id, s.class_name));
    } catch {
      // Silent – students list stays empty
    }
  }, [supabase, ensureClassInList]);

  // ── Effects ──

  useEffect(() => {
    fetchClasses();
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSelectedStudentId(studentParam);
  }, [searchParams, students, selectedStudentId, ensureClassInList]);

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

  return {
    // State
    classes,
    selectedClassId,
    students,
    studentSearch,
    setStudentSearch,
    selectedStudentId,
    selectedWeek,
    setSelectedWeek,
    mode,
    loading,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownRef,
    currentWeek,

    // Derived
    filteredStudents,
    selectedClassName,

    // Handlers
    handleModeChange,
    handleWeekChange,
    handleClassSelect,
    handleStudentSelect,
    clearStudentSelection,
  };
}
