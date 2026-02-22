"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import FeedbackBubble, {
  type FeedbackData,
} from "@/components/student/FeedbackBubble";
import { resolveTeacherNames } from "@/utils/resolve-teacher-names";

// ── Types ────────────────────────────────────────────
type FeedbackItem = {
  id: string;
  task_id: string;
  created_at: string;
  teacher_reaction: string | null;
  teacher_comment: string | null;
  read_at: string | null;
  task: {
    title: string;
    subject: {
      title: string;
      emoji: string;
    } | null;
  } | null;
  teacher: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface FeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

// ── Helper: fetch feedback rows from Supabase ───────
async function fetchFeedbackRows(studentId: string): Promise<FeedbackItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("feedback")
    .select(
      `
      id,
      task_id,
      created_at,
      teacher_reaction,
      teacher_comment,
      read_at,
      task:tasks!feedback_task_id_fkey (
        title,
        subject:subjects!tasks_subject_id_fkey ( title, emoji )
      ),
      teacher:profiles!feedback_teacher_id_fkey ( full_name, avatar_url )
    `,
    )
    .eq("student_id", studentId)
    .or("teacher_reaction.not.is.null,teacher_comment.not.is.null")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => {
    const task = Array.isArray(row.task) ? row.task[0] : row.task;
    const teacher = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
    let subject = null;
    if (task?.subject) {
      subject = Array.isArray(task.subject)
        ? (task.subject[0] ?? null)
        : task.subject;
    }
    return {
      id: row.id as string,
      task_id: row.task_id as string,
      created_at: row.created_at as string,
      teacher_reaction: row.teacher_reaction as string | null,
      teacher_comment: row.teacher_comment as string | null,
      read_at: row.read_at as string | null,
      task: task ? { title: task.title, subject } : null,
      teacher: teacher ?? null,
    };
  });
}

// ── Component ────────────────────────────────────────
export default function FeedbackSheet({
  isOpen,
  onClose,
  studentId,
}: FeedbackSheetProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch when sheet opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (!justOpened || !studentId) return;

    let cancelled = false;

    fetchFeedbackRows(studentId).then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, studentId]);

  // Auto-mark as read 2s after opening (so student sees ✨ briefly)
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    const unreadIds = items.filter((i) => !i.read_at).map((i) => i.id);
    if (unreadIds.length === 0) return;

    const timer = setTimeout(async () => {
      const supabase = createClient();
      const now = new Date().toISOString();

      await supabase
        .from("feedback")
        .update({ read_at: now })
        .in("id", unreadIds)
        .is("read_at", null);

      setItems((prev) =>
        prev.map((i) =>
          unreadIds.includes(i.id) ? { ...i, read_at: now } : i,
        ),
      );

      window.dispatchEvent(new Event("feedback-read"));
    }, 2000);
    return () => clearTimeout(timer);
  }, [isOpen, items]);

  // Resolve teacher display names (smart progressive disclosure)
  const nameMap = useMemo(
    () => resolveTeacherNames(items.map((i) => i.teacher?.full_name)),
    [items],
  );

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
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Sheet — slides from right */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md sm:max-w-lg bg-slate-50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Skryteveggen
                  </h2>
                  <p className="text-[11px] text-slate-400">Fra lærerne dine</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-1 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-amber-300 border-t-transparent" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-slate-500 font-medium text-sm">
                    Ingen tilbakemeldinger ennå
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Fullfør oppgaver for å få skryt fra læreren!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((item, idx) => {
                    const subjectEmoji = item.task?.subject?.emoji || "📚";
                    const subjectTitle = item.task?.subject?.title || "";
                    const taskTitle = item.task?.title || "Oppgave";

                    const fullName = item.teacher?.full_name || "Lærer";
                    const displayName = nameMap.get(fullName) || fullName;

                    const feedbackData: FeedbackData = {
                      teacher_reaction: item.teacher_reaction,
                      teacher_comment: item.teacher_comment,
                      read_at: item.read_at,
                      teacher: item.teacher,
                    };

                    // Build pill label: "📚 Matematikk · Brøk"
                    const pillParts = [subjectEmoji];
                    if (subjectTitle) pillParts.push(subjectTitle);
                    const pillLabel =
                      pillParts.join(" ") +
                      (taskTitle ? ` · ${taskTitle}` : "");

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          delay: Math.min(idx * 0.06, 0.3),
                        }}
                        className="bg-amber-50/80 rounded-2xl shadow-sm border border-amber-100/60 p-5 pb-5"
                      >
                        {/* Subject · Task pill */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 text-[11px] font-medium text-amber-700/70 mb-3">
                          {pillLabel}
                        </span>

                        {/* Hero: teacher + feedback content */}
                        <FeedbackBubble
                          feedback={feedbackData}
                          displayName={displayName}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
