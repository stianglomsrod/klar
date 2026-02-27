"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { updateStudentClass } from "@/app/actions/student-actions";
import type { ClassOption } from "@/types/shared";

/** "5A" → "5. Trinn", "10B" → "10. Trinn" */
function inferGradeName(className: string): string {
  const match = className.match(/^(\d+)/);
  return match ? `${match[1]}. Trinn` : "Annet";
}

interface ClassComboboxProps {
  studentId: string;
  initialClassName: string | null;
  onClassChanged?: (className: string, level: number | null) => void;
}

export default function ClassCombobox({
  studentId,
  initialClassName,
  onClassChanged,
}: ClassComboboxProps) {
  const supabase = createClient();

  const [, setSelectedClass] = useState(initialClassName || "");
  const [classSearch, setClassSearch] = useState(initialClassName || "");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [classUpdating, setClassUpdating] = useState(false);

  // ── Fetch available classes ────────────────────────
  const fetchClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grades:grade_id(name)")
        .order("name");
      if (error) throw error;
      setClasses(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          grade_name: c.grades?.name || null,
        })),
      );
    } catch {
      // Silent – classes list stays empty
    } finally {
      setClassesLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // ── Filtering ──────────────────────────────────────
  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(classSearch.toLowerCase()),
  );
  const exactMatch = classes.some(
    (c) => c.name.toLowerCase() === classSearch.trim().toLowerCase(),
  );

  // ── Handlers ───────────────────────────────────────
  const handleSelectClass = useCallback(
    async (cls: ClassOption) => {
      setSelectedClass(cls.name);
      setClassSearch(cls.name);
      setComboOpen(false);

      setClassUpdating(true);
      const result = await updateStudentClass(
        studentId,
        cls.name,
        cls.grade_name || inferGradeName(cls.name),
      );
      setClassUpdating(false);

      if (result.success && onClassChanged) {
        const levelMatch = (cls.grade_name || cls.name).match(/^(\d+)/);
        onClassChanged(
          cls.name,
          levelMatch ? parseInt(levelMatch[1], 10) : null,
        );
      }
    },
    [studentId, onClassChanged],
  );

  const handleCreateClass = useCallback(async () => {
    const name = classSearch.trim();
    if (!name) return;
    const grade = inferGradeName(name);
    setSelectedClass(name);
    setClassSearch(name);
    setComboOpen(false);

    setClassUpdating(true);
    const result = await updateStudentClass(studentId, name, grade);
    setClassUpdating(false);

    if (result.success) {
      fetchClasses();
      const levelMatch = name.match(/^(\d+)/);
      if (onClassChanged) {
        onClassChanged(name, levelMatch ? parseInt(levelMatch[1], 10) : null);
      }
    }
  }, [classSearch, studentId, fetchClasses, onClassChanged]);

  return (
    <div>
      <label className="text-sm font-medium text-slate-900 block mb-2">
        Klasse
        {classUpdating && (
          <Loader2 className="inline h-3 w-3 ml-1.5 animate-spin text-indigo-500" />
        )}
      </label>
      <Popover open={comboOpen} onOpenChange={setComboOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Søk etter klasse…"
              value={classSearch}
              onChange={(e) => {
                setClassSearch(e.target.value);
                setSelectedClass("");
                if (!comboOpen) setComboOpen(true);
              }}
              onFocus={() => setComboOpen(true)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] z-[100]"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-48 overflow-y-auto">
            {classesLoading ? (
              <div className="px-4 py-3 text-sm text-slate-400">
                Laster klasser…
              </div>
            ) : filteredClasses.length === 0 && !classSearch.trim() ? (
              <div className="px-4 py-3 text-sm text-slate-400">
                Ingen klasser funnet.
              </div>
            ) : filteredClasses.length === 0 && classSearch.trim() ? (
              <button
                type="button"
                onClick={handleCreateClass}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors flex items-center gap-2 text-green-700 font-medium"
              >
                <Plus className="h-4 w-4" />
                Opprett klasse &ldquo;{classSearch.trim()}&rdquo;
              </button>
            ) : (
              <>
                {filteredClasses.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => handleSelectClass(cls)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-700">
                      {cls.name}
                    </span>
                    {cls.grade_name && (
                      <span className="text-xs text-slate-400">
                        {cls.grade_name}
                      </span>
                    )}
                  </button>
                ))}
                {classSearch.trim() && !exactMatch && (
                  <button
                    type="button"
                    onClick={handleCreateClass}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors flex items-center gap-2 border-t border-slate-100 text-green-700 font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Opprett klasse &ldquo;{classSearch.trim()}&rdquo;
                  </button>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
