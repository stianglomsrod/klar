"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  Calendar,
  CheckCircle,
  Zap,
  MessageSquare,
  Undo2,
  Clock,
  Send,
} from "lucide-react";
import {
  useTeacherProfile,
  getDisplayName,
  getInitials,
} from "@/contexts/TeacherProfileContext";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// ── Types ──────────────────────────────────────────────
type ActivityItem = {
  id: string; // task id
  title: string;
  points_value: number;
  completed_at: string;
  student: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  subject: {
    title: string;
    emoji: string;
  } | null;
  feedback: {
    id: string;
    student_comment: string | null;
    student_audio_url: string | null;
    teacher_reaction: string | null;
    teacher_comment: string | null;
  } | null;
};

// ── Helpers ────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  if (!dateStr || isNaN(new Date(dateStr).getTime())) return "Nylig";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "akkurat nå";
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "time" : "timer"} siden`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ${days === 1 ? "dag" : "dager"} siden`;
  return new Date(dateStr).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

const QUICK_REACTIONS = ["👍", "🌟", "💪", "🎉", "❤️", "🔥"];

export default function TeacherDashboard() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useTeacherProfile();
  const firstName = profileLoading
    ? "..."
    : (getDisplayName(profile).split(" ")[0] ?? "Lærer");

  // ── Activity state ─────────────────────────────────
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // Feedback popover
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Return task
  const [returningId, setReturningId] = useState<string | null>(null);

  // ── Fetch activities ───────────────────────────────
  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          points_value,
          completed_at,
          student:profiles!tasks_student_id_fkey (id, full_name, avatar_url),
          subject:subjects!tasks_subject_id_fkey (title, emoji),
          feedback (id, student_comment, student_audio_url, teacher_reaction, teacher_comment)
        `,
        )
        .eq("created_by", user.id)
        .eq("is_completed", true)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const items: ActivityItem[] = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        points_value: t.points_value ?? 0,
        completed_at: t.completed_at ?? t.created_at,
        student: Array.isArray(t.student) ? t.student[0] : t.student,
        subject: Array.isArray(t.subject) ? t.subject[0] : t.subject,
        feedback: Array.isArray(t.feedback)
          ? (t.feedback[0] ?? null)
          : t.feedback,
      }));

      setActivities(items);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  // ── Close popover on outside click ─────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setFeedbackOpenId(null);
        setFeedbackComment("");
      }
    };
    if (feedbackOpenId) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [feedbackOpenId]);

  // ── Save reaction / comment ────────────────────────
  const handleSaveFeedback = async (
    taskId: string,
    reaction?: string,
    comment?: string,
  ) => {
    setSavingFeedback(true);
    try {
      const activity = activities.find((a) => a.id === taskId);
      if (!activity) return;

      const updates: Record<string, string | null> = {};
      if (reaction !== undefined) updates.teacher_reaction = reaction;
      if (comment !== undefined) updates.teacher_comment = comment || null;

      if (activity.feedback?.id) {
        // Update existing feedback row
        const { error } = await supabase
          .from("feedback")
          .update(updates)
          .eq("id", activity.feedback.id);
        if (error) throw error;
      } else {
        // Insert new feedback row
        const { error } = await supabase.from("feedback").insert({
          task_id: taskId,
          student_id: activity.student.id,
          ...updates,
        });
        if (error) throw error;
      }

      // Optimistic update
      setActivities((prev) =>
        prev.map((a) =>
          a.id === taskId
            ? {
                ...a,
                feedback: {
                  id: a.feedback?.id ?? "temp",
                  student_comment: a.feedback?.student_comment ?? null,
                  student_audio_url: a.feedback?.student_audio_url ?? null,
                  teacher_reaction:
                    reaction ?? a.feedback?.teacher_reaction ?? null,
                  teacher_comment:
                    comment !== undefined
                      ? comment || null
                      : (a.feedback?.teacher_comment ?? null),
                },
              }
            : a,
        ),
      );

      if (comment !== undefined) {
        setFeedbackOpenId(null);
        setFeedbackComment("");
      }
    } catch (err) {
      console.error("Error saving feedback:", err);
      alert("Kunne ikke lagre tilbakemelding. Prøv igjen.");
    } finally {
      setSavingFeedback(false);
    }
  };

  // ── Return task (undo completion) ──────────────────
  const handleReturnTask = async (taskId: string) => {
    setReturningId(taskId);
    try {
      const activity = activities.find((a) => a.id === taskId);
      if (!activity) return;

      // 1. Set task back to incomplete
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ is_completed: false, completed_at: null })
        .eq("id", taskId);
      if (taskError) throw taskError;

      // 2. Deduct points from student
      if (activity.points_value > 0) {
        const { data: sp } = await supabase
          .from("student_profiles")
          .select("points_earned")
          .eq("id", activity.student.id)
          .single();

        const newPoints = Math.max(
          0,
          (sp?.points_earned ?? 0) - activity.points_value,
        );

        const { error: pointsError } = await supabase
          .from("student_profiles")
          .update({ points_earned: newPoints })
          .eq("id", activity.student.id);
        if (pointsError) throw pointsError;
      }

      // 3. Remove from feed
      setActivities((prev) => prev.filter((a) => a.id !== taskId));
    } catch (err) {
      console.error("Error returning task:", err);
      alert("Kunne ikke sende i retur. Prøv igjen.");
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Hei, {firstName} 👋
        </h1>
        <p className="text-slate-600">
          Velkommen til lærer dashboardet. Her kan du administrere klasser,
          oppgaver og følge med på elevenes fremgang.
        </p>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Dagens Melding */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Dagens Melding
            </h2>
          </div>

          <div className="space-y-3">
            <textarea
              placeholder="Skriv en melding til elevene..."
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={4}
            />
            <button className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              Send Melding
            </button>
          </div>
        </div>

        {/* Widget 2: Venter på godkjenning */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Venter på godkjenning
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Fullførte oppgaver
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Trykk for å se detaljer
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-700 font-bold">
                {activities.length}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors">
                Se alle
              </button>
            </div>
          </div>
        </div>

        {/* Widget 3: Hurtighandlinger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Hurtighandlinger
            </h2>
          </div>

          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors text-left">
              + Ny oppgave
            </button>
            <button className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg transition-colors text-left">
              + Legg til elev
            </button>
            <button className="w-full px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium rounded-lg transition-colors text-left">
              📊 Vis statistikk
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent Activity Feed ────────────────────── */}
      <div className="mt-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-semibold text-slate-900">
              Siste aktivitet
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Nylig fullførte oppgaver fra elevene dine
            </p>
          </div>

          {loadingActivities ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Laster aktivitet...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 px-6">
              <CheckCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                Ingen fullførte oppgaver å vise ennå.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {activities.map((activity) => {
                const studentName =
                  activity.student?.full_name || "Ukjent elev";
                const studentInitials = getInitials(
                  activity.student?.full_name,
                  "E",
                );

                return (
                  <div
                    key={activity.id}
                    className="p-3 sm:p-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Student avatar */}
                      <Link
                        href={`/teacher/students/${activity.student?.id}`}
                        className="shrink-0"
                      >
                        {activity.student?.avatar_url ? (
                          <img
                            src={activity.student.avatar_url}
                            alt={studentName}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs">
                            {studentInitials}
                          </div>
                        )}
                      </Link>

                      {/* Info — middle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap text-sm">
                          <Link
                            href={`/teacher/students/${activity.student?.id}`}
                            className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                          >
                            {studentName}
                          </Link>
                          <span className="text-slate-400">fullførte</span>
                          <span className="font-medium text-slate-700 truncate">
                            {activity.subject?.emoji && (
                              <span className="mr-0.5">
                                {activity.subject.emoji}
                              </span>
                            )}
                            {activity.title}
                          </span>

                          {activity.points_value > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full">
                              ⭐ {activity.points_value}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-xs text-slate-400 ml-auto sm:ml-0">
                            <Clock className="h-3 w-3" />
                            {timeAgo(activity.completed_at)}
                          </span>
                        </div>

                        {/* Student submission */}
                        {activity.feedback?.student_comment && (
                          <p className="mt-1.5 text-sm text-slate-600 italic bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            &ldquo;{activity.feedback.student_comment}&rdquo;
                          </p>
                        )}

                        {activity.feedback?.student_audio_url && (
                          <div className="mt-1.5">
                            <audio
                              controls
                              src={activity.feedback.student_audio_url}
                              className="h-8 w-full max-w-xs"
                            />
                          </div>
                        )}

                        {/* Existing teacher feedback display */}
                        {(activity.feedback?.teacher_reaction ||
                          activity.feedback?.teacher_comment) && (
                          <div className="mt-1.5 flex items-center gap-2 text-sm">
                            {activity.feedback.teacher_reaction && (
                              <span className="text-base">
                                {activity.feedback.teacher_reaction}
                              </span>
                            )}
                            {activity.feedback.teacher_comment && (
                              <span className="text-slate-600 italic">
                                {activity.feedback.teacher_comment}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons — right */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Feedback / Reaction button */}
                        <div className="relative">
                          <button
                            onClick={() => {
                              setFeedbackOpenId(
                                feedbackOpenId === activity.id
                                  ? null
                                  : activity.id,
                              );
                              setFeedbackComment(
                                activity.feedback?.teacher_comment ?? "",
                              );
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              Tilbakemelding
                            </span>
                          </button>

                          {/* Feedback popover */}
                          {feedbackOpenId === activity.id && (
                            <div
                              ref={popoverRef}
                              className="absolute right-0 top-full mt-1 z-30 w-72 bg-white rounded-xl border border-slate-200 shadow-lg p-4"
                            >
                              {/* Quick reactions */}
                              <p className="text-xs font-medium text-slate-500 mb-2">
                                Hurtigreaksjon
                              </p>
                              <div className="flex gap-1 mb-3">
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() =>
                                      handleSaveFeedback(
                                        activity.id,
                                        emoji,
                                        undefined,
                                      )
                                    }
                                    className={`text-xl p-1.5 rounded-lg transition-colors ${
                                      activity.feedback?.teacher_reaction ===
                                      emoji
                                        ? "bg-indigo-100 ring-2 ring-indigo-400"
                                        : "hover:bg-slate-100"
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>

                              {/* Comment */}
                              <p className="text-xs font-medium text-slate-500 mb-2">
                                Kommentar
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={feedbackComment}
                                  onChange={(e) =>
                                    setFeedbackComment(e.target.value)
                                  }
                                  placeholder="Skriv en kommentar..."
                                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !savingFeedback) {
                                      handleSaveFeedback(
                                        activity.id,
                                        undefined,
                                        feedbackComment,
                                      );
                                    }
                                  }}
                                />
                                <button
                                  onClick={() =>
                                    handleSaveFeedback(
                                      activity.id,
                                      undefined,
                                      feedbackComment,
                                    )
                                  }
                                  disabled={savingFeedback}
                                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                                >
                                  <Send className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Return task — AlertDialog */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Undo2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">
                                Send i retur
                              </span>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Send oppgave i retur?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Oppgaven &ldquo;{activity.title}&rdquo; blir
                                satt tilbake til ugjort
                                {activity.points_value > 0 &&
                                  ` og ${activity.points_value} poeng trekkes fra ${studentName}`}
                                .
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => handleReturnTask(activity.id)}
                              >
                                {returningId === activity.id
                                  ? "Sender..."
                                  : "Ja, send i retur"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
