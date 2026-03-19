"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { isImageUrl } from "@/utils/avatar";
import { timeAgo } from "@/utils/format-time";
import { useRouter } from "next/navigation";

interface Assignment {
  id: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  student: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  feedback: {
    teacher_reaction: string | null;
    teacher_comment: string | null;
  } | null;
}

interface TaskAssignmentsSheetProps {
  taskLibraryId: string | null;
  taskTitle: string;
  subjectEmoji: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskAssignmentsSheet({
  taskLibraryId,
  taskTitle,
  subjectEmoji,
  isOpen,
  onClose,
}: TaskAssignmentsSheetProps) {
  const supabase = createClient();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignments = useCallback(async () => {
    if (!taskLibraryId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          is_completed,
          completed_at,
          created_at,
          student:profiles!tasks_student_id_fkey (
            id,
            full_name,
            avatar_url
          ),
          feedback (
            teacher_reaction,
            teacher_comment
          )
        `,
        )
        .eq("task_library_id", taskLibraryId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Assignment[] = (data || []).map((row: any) => ({
        id: row.id,
        is_completed: row.is_completed,
        completed_at: row.completed_at,
        created_at: row.created_at,
        student: row.student || {
          id: "",
          full_name: "Ukjent elev",
          avatar_url: null,
        },
        feedback: row.feedback?.[0] ?? row.feedback ?? null,
      }));

      setAssignments(mapped);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [supabase, taskLibraryId]);

  useEffect(() => {
    if (isOpen && taskLibraryId) {
      fetchAssignments();
    }
  }, [isOpen, taskLibraryId, fetchAssignments]);

  const completedCount = assignments.filter((a) => a.is_completed).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {subjectEmoji} {taskTitle}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {assignments.length} tildelinger · {completedCount} fullført
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">
                    Denne oppgaven er ikke tildelt noen elever ennå.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {assignments.map((a) => {
                    const name = a.student.full_name || "Ukjent elev";
                    const initial = name.charAt(0).toUpperCase();

                    return (
                      <li key={a.id}>
                        <button
                          onClick={() => {
                            if (a.student.id) {
                              router.push(
                                `/teacher/students/${a.student.id}`,
                              );
                              onClose();
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                        >
                          {/* Avatar */}
                          {isImageUrl(a.student.avatar_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.student.avatar_url}
                              alt={name}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : a.student.avatar_url ? (
                            <span className="flex items-center justify-center w-9 h-9 text-xl shrink-0">
                              {a.student.avatar_url}
                            </span>
                          ) : (
                            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                              {initial}
                            </span>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {a.is_completed && a.completed_at
                                ? `Fullført ${timeAgo(a.completed_at)}`
                                : `Tildelt ${timeAgo(a.created_at)}`}
                            </p>
                          </div>

                          {/* Status + feedback indicators */}
                          <div className="flex items-center gap-2 shrink-0">
                            {a.feedback?.teacher_reaction && (
                              <span className="text-base">
                                {a.feedback.teacher_reaction}
                              </span>
                            )}
                            {a.is_completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Clock className="h-5 w-5 text-amber-400" />
                            )}
                            <ExternalLink className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
