"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Loader2, X, Users, Check } from "lucide-react";
import { updateStudentClass } from "@/app/actions/student-actions";

type StudentRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  class_id: string | null;
  class_name: string | null;
};

interface BulkStudentAssignModalProps {
  targetClassId: string;
  targetClassName: string;
  /** Called after students have been assigned (so the parent can refresh) */
  onComplete: () => void;
  onClose: () => void;
}

export default function BulkStudentAssignModal({
  targetClassId,
  targetClassName,
  onComplete,
  onClose,
}: BulkStudentAssignModalProps) {
  const supabase = createClient();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch all students with their class info ───────
  useEffect(() => {
    let cancelled = false;

    async function fetchStudents() {
      setLoading(true);
      try {
        const { data, error: fetchErr } = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            avatar_url,
            student_profiles (
              class_id,
              classes (name)
            )
          `,
          )
          .eq("role", "student")
          .order("full_name", { ascending: true });

        if (fetchErr) throw fetchErr;
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: StudentRow[] = (data || []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          class_id: p.student_profiles?.class_id ?? null,
          class_name: p.student_profiles?.classes?.name ?? null,
        }));
        setStudents(rows);
      } catch {
        // Silent — empty list
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStudents();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived: eligible students (not already in target class) ──
  const eligibleStudents = useMemo(
    () => students.filter((s) => s.class_id !== targetClassId),
    [students, targetClassId],
  );

  // ── Derived: filtered by search ────────────────────
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleStudents;
    return eligibleStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.class_name && s.class_name.toLowerCase().includes(q)),
    );
  }, [eligibleStudents, searchQuery]);

  // ── Already assigned count ─────────────────────────
  const alreadyAssignedCount = useMemo(
    () => students.filter((s) => s.class_id === targetClassId).length,
    [students, targetClassId],
  );

  // ── Toggle selection ───────────────────────────────
  const toggleStudent = useCallback((studentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  // ── Select / deselect all visible ──────────────────
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allVisibleIds = filteredStudents.map((s) => s.id);
      const allSelected = allVisibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [filteredStudents]);

  // ── Infer grade name from target class ─────────────
  const inferGradeName = (className: string): string => {
    const match = className.match(/^(\d+)/);
    return match ? `${match[1]}. Trinn` : "Annet";
  };

  // ── Submit: assign all selected students ───────────
  const handleSubmit = useCallback(async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);

    const gradeName = inferGradeName(targetClassName);
    const ids = Array.from(selected);

    let failCount = 0;
    for (const studentId of ids) {
      const result = await updateStudentClass(
        studentId,
        targetClassName,
        gradeName,
      );
      if (!result.success) {
        failCount++;
      }
    }

    setSubmitting(false);

    if (failCount > 0) {
      setError(
        `${failCount} av ${ids.length} elever kunne ikke flyttes. Prøv igjen.`,
      );
    } else {
      onComplete();
      onClose();
    }
  }, [selected, targetClassName, onComplete, onClose]);

  const selectedCount = selected.size;
  const allVisibleSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selected.has(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Legg til elever i {targetClassName}
            </h3>
            {alreadyAssignedCount > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                {alreadyAssignedCount} elev
                {alreadyAssignedCount !== 1 ? "er" : ""} allerede i klassen
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Søk etter elever..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <span className="ml-2 text-sm text-slate-500">
                Laster elever...
              </span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-slate-500">
                {searchQuery.trim()
                  ? "Ingen elever funnet"
                  : "Alle elever er allerede i denne klassen"}
              </p>
            </div>
          ) : (
            <>
              {/* Select all toggle */}
              <button
                onClick={toggleAll}
                className="w-full px-5 py-2 flex items-center gap-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors border-b border-slate-100"
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    allVisibleSelected
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-slate-300"
                  }`}
                >
                  {allVisibleSelected && (
                    <Check className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                {allVisibleSelected ? "Fjern alle" : "Velg alle"}
                <span className="ml-auto text-slate-400 font-normal">
                  {filteredStudents.length} elev
                  {filteredStudents.length !== 1 ? "er" : ""}
                </span>
              </button>

              {/* Student rows */}
              {filteredStudents.map((student) => {
                const isSelected = selected.has(student.id);
                return (
                  <button
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className={`w-full px-5 py-2.5 flex items-center gap-3 transition-colors ${
                      isSelected
                        ? "bg-indigo-50 hover:bg-indigo-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xs flex-shrink-0">
                      {student.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={student.avatar_url}
                          alt={student.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        student.full_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Name + current class */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {student.full_name}
                      </p>
                      {student.class_name && (
                        <p className="text-xs text-slate-500 truncate">
                          Nåværende klasse: {student.class_name}
                        </p>
                      )}
                      {!student.class_name && (
                        <p className="text-xs text-slate-400">Ingen klasse</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <p className="text-sm text-slate-600">
            {selectedCount > 0
              ? `${selectedCount} elev${selectedCount !== 1 ? "er" : ""} valgt`
              : "Velg elever fra listen"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedCount === 0 || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Legg til {selectedCount > 0 ? `${selectedCount} ` : ""}elev
              {selectedCount !== 1 ? "er" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
