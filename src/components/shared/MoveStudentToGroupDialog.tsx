"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type MoveStudentToGroupDialogProps = {
  studentId: string;
  studentName: string;
  currentGroupId: string;
  currentGroupName: string;
  teacherId: string;
  onMoved: (newGroupName: string) => void;
  onClose: () => void;
};

type GroupOption = { id: string; name: string };

export default function MoveStudentToGroupDialog({
  studentId,
  studentName,
  currentGroupId,
  currentGroupName,
  teacherId,
  onMoved,
  onClose,
}: MoveStudentToGroupDialogProps) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [moving, setMoving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase
        .from("student_groups")
        .select("id, name")
        .eq("created_by", teacherId)
        .neq("id", currentGroupId)
        .order("name", { ascending: true });
      setGroups(data ?? []);
      setLoading(false);
    };
    fetchGroups();
  }, [supabase, teacherId, currentGroupId]);

  const handleMove = async () => {
    if (!selectedGroupId) return;
    setMoving(true);
    try {
      // Remove from current group
      const { error: removeErr } = await supabase
        .from("student_group_members")
        .delete()
        .eq("group_id", currentGroupId)
        .eq("student_id", studentId);
      if (removeErr) throw removeErr;

      // Add to new group
      const { error: addErr } = await supabase
        .from("student_group_members")
        .insert({ group_id: selectedGroupId, student_id: studentId });
      if (addErr) throw addErr;

      const newGroup = groups.find((g) => g.id === selectedGroupId);
      onMoved(newGroup?.name ?? "ny gruppe");
    } catch {
      // Silent — parent will show toast
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-3 sm:mx-4 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Flytt {studentName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-3">
          Nåværende gruppe:{" "}
          <span className="font-medium text-slate-700">{currentGroupName}</span>
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Ingen andre grupper tilgjengelig. Opprett en ny gruppe først.
          </p>
        ) : (
          <>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Velg ny gruppe
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="">— Velg gruppe —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <div className="flex gap-3 mt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleMove}
                disabled={!selectedGroupId || moving}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {moving ? "Flytter..." : "Flytt"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
