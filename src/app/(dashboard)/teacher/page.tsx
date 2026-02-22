"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, Zap, Clock, ChevronRight } from "lucide-react";
import {
  useTeacherProfile,
  getDisplayName,
  getInitials,
} from "@/contexts/TeacherProfileContext";
import ActivityDetailSheet, {
  type ActivityDetail,
} from "@/components/teacher/ActivityDetailSheet";
import RecentStudents from "@/components/teacher/RecentStudents";
import TaskCreatorModal from "@/components/teacher/CreateTaskModal";

// ── Types ──────────────────────────────────────────────
type ActivityItem = ActivityDetail;

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

export default function TeacherDashboard() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useTeacherProfile();
  const firstName = profileLoading
    ? "..."
    : (getDisplayName(profile).split(" ")[0] ?? "Lærer");

  // ── Activity state ─────────────────────────────────
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // Feedback / Return
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  // Detail sheet
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null,
  );

  // Create task modal
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

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
          description,
          points_value,
          completed_at,
          type,
          quiz_data,
          student:profiles!tasks_student_id_fkey (id, full_name, avatar_url),
          subject:subjects!tasks_subject_id_fkey (title, emoji),
          feedback (id, student_comment, student_audio_url, student_image_url, quiz_responses, teacher_reaction, teacher_comment, teacher_id, read_at)
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
        description: t.description ?? null,
        points_value: t.points_value ?? 0,
        completed_at: t.completed_at ?? t.created_at,
        type: t.type ?? "standard",
        quiz_data: t.quiz_data ?? null,
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

      // Always attach teacher_id
      if (profile?.id) updates.teacher_id = profile.id;

      if (activity.feedback?.id) {
        const { error } = await supabase
          .from("feedback")
          .update(updates)
          .eq("id", activity.feedback.id);
        if (error) throw error;
      } else {
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
                  student_image_url: a.feedback?.student_image_url ?? null,
                  quiz_responses: a.feedback?.quiz_responses ?? null,
                  teacher_reaction:
                    reaction ?? a.feedback?.teacher_reaction ?? null,
                  teacher_comment:
                    comment !== undefined
                      ? comment || null
                      : (a.feedback?.teacher_comment ?? null),
                  teacher_id: profile?.id ?? a.feedback?.teacher_id ?? null,
                  read_at: a.feedback?.read_at ?? null,
                },
              }
            : a,
        ),
      );
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

      // 2. Deduct points from student (with level demotion if needed)
      if (activity.points_value > 0) {
        const { data: sp } = await supabase
          .from("student_profiles")
          .select("points_earned, current_xp, level, current_goal_total")
          .eq("id", activity.student.id)
          .single();

        const currentXp = sp?.current_xp ?? 0;
        const currentLevel = sp?.level ?? 1;
        const goalTotal = sp?.current_goal_total ?? 1000;
        let rawXp = currentXp - activity.points_value;
        let newLevel = currentLevel;

        // If XP goes negative, the returned task had triggered a level-up
        // → demote levels, wrap XP back into previous level's range
        // (handles multi-level demotions; rewards/petals stay untouched)
        while (rawXp < 0 && newLevel > 1) {
          newLevel -= 1;
          rawXp += goalTotal;
        }

        const newCurrentXp = Math.max(0, rawXp);
        const newPoints = Math.max(
          0,
          (sp?.points_earned ?? 0) - activity.points_value,
        );

        const { error: pointsError } = await supabase
          .from("student_profiles")
          .update({
            points_earned: newPoints,
            current_xp: newCurrentXp,
            level: newLevel,
          })
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
        {/* Widget 1: Nylig besøkte elever */}
        <RecentStudents />

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
            <button
              onClick={() => setCreateTaskOpen(true)}
              className="w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors text-left"
            >
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
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => setSelectedActivity(activity)}
                    className="w-full text-left p-3 sm:p-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Student avatar */}
                      <div className="shrink-0">
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
                      </div>

                      {/* Info — middle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap text-sm">
                          <span className="font-semibold text-slate-900">
                            {studentName}
                          </span>
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
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {timeAgo(activity.completed_at)}
                          </span>

                          {activity.type === "quiz" && (
                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              Quiz
                            </span>
                          )}

                          {/* Teacher feedback indicator */}
                          {activity.feedback?.teacher_reaction && (
                            <span className="text-sm">
                              {activity.feedback.teacher_reaction}
                            </span>
                          )}
                          {activity.feedback?.teacher_comment && (
                            <span className="text-xs text-slate-500 italic truncate max-w-[150px]">
                              {activity.feedback.teacher_comment}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Detail Sheet ───────────────────── */}
      <ActivityDetailSheet
        activity={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onSaveFeedback={async (taskId, reaction, comment) => {
          await handleSaveFeedback(taskId, reaction, comment);
          // Update the selected activity in-place so sheet reflects changes
          setSelectedActivity((prev) => {
            if (!prev || prev.id !== taskId) return prev;
            return {
              ...prev,
              feedback: {
                id: prev.feedback?.id ?? "temp",
                student_comment: prev.feedback?.student_comment ?? null,
                student_audio_url: prev.feedback?.student_audio_url ?? null,
                student_image_url: prev.feedback?.student_image_url ?? null,
                quiz_responses: prev.feedback?.quiz_responses ?? null,
                teacher_reaction:
                  reaction ?? prev.feedback?.teacher_reaction ?? null,
                teacher_comment:
                  comment !== undefined
                    ? comment || null
                    : (prev.feedback?.teacher_comment ?? null),
                teacher_id: profile?.id ?? prev.feedback?.teacher_id ?? null,
                read_at: prev.feedback?.read_at ?? null,
              },
            };
          });
        }}
        onReturnTask={handleReturnTask}
        returningId={returningId}
        savingFeedback={savingFeedback}
      />

      {/* ── Create Task Modal ───────────────────────── */}
      <TaskCreatorModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => {
          setCreateTaskOpen(false);
          fetchActivities();
        }}
      />
    </div>
  );
}
