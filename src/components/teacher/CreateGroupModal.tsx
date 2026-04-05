"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Search, Loader2, Check } from "lucide-react";

type StudentOption = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  class_name: string | null;
};

type CreateGroupModalProps = {
  teacherId: string;
  onCreated: () => void;
  onClose: () => void;
};

export default function CreateGroupModal({
  teacherId,
  onCreated,
  onClose,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch all accessible students
  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            avatar_url,
            student_profiles (
              classes (
                name
              )
            )
          `,
          )
          .eq("role", "student")
          .order("full_name", { ascending: true });

        if (fetchError) throw fetchError;

        const mapped: StudentOption[] = (data || []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          class_name: p.student_profiles?.classes?.name ?? null,
        }));

        setStudents(mapped);
      } catch {
        setError("Kunne ikke laste elever");
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [supabase]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      setError("Gruppenavn er påkrevd");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Velg minst én elev");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from("student_groups")
        .insert({ name: groupName.trim(), created_by: teacherId })
        .select("id")
        .single();

      if (groupError) throw groupError;

      // Add members
      const members = Array.from(selectedIds).map((studentId) => ({
        group_id: groupData.id,
        student_id: studentId,
      }));

      const { error: membersError } = await supabase
        .from("student_group_members")
        .insert(members);

      if (membersError) throw membersError;

      onCreated();
    } catch {
      setError("Kunne ikke opprette gruppen. Prøv igjen.");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = search.trim()
    ? students.filter(
        (s) =>
          s.full_name.toLowerCase().includes(search.toLowerCase()) ||
          s.class_name?.toLowerCase().includes(search.toLowerCase()),
      )
    : students;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Opprett ny gruppe
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Group Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Gruppenavn
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="F.eks. Sløyd delingstime"
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Student Search */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Velg elever ({selectedIds.size} valgt)
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk etter elev eller klasse..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Student list */}
            <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-500">
                  {search.trim() ? "Ingen treff" : "Ingen elever funnet"}
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedIds.has(student.id);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudent(student.id)}
                      className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-50 hover:bg-indigo-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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
                      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600 flex-shrink-0">
                        {student.avatar_url || student.full_name.charAt(0)}
                      </div>

                      {/* Name + class */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-800 block truncate">
                          {student.full_name}
                        </span>
                        {student.class_name && (
                          <span className="text-xs text-slate-500">
                            {student.class_name}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !groupName.trim() || selectedIds.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Opprett gruppe
          </button>
        </div>
      </div>
    </div>
  );
}
