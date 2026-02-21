"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Clock,
  MessageSquare,
  Undo2,
  Send,
  FileText,
  Image as ImageIcon,
  Volume2,
} from "lucide-react";
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

// ── Types ────────────────────────────────────────────
type QuizQuestion = {
  id: string;
  text: string;
  answerType: "text" | "radio" | "checkbox";
  options: string[];
};

export type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  points_value: number;
  completed_at: string;
  type: "standard" | "quiz";
  quiz_data: QuizQuestion[] | null;
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
    student_image_url: string | null;
    quiz_responses: Record<
      string,
      string | string[] | { answer: string | string[]; audioUrl?: string }
    > | null;
    teacher_reaction: string | null;
    teacher_comment: string | null;
  } | null;
};

interface ActivityDetailSheetProps {
  activity: ActivityDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveFeedback: (
    taskId: string,
    reaction?: string,
    comment?: string,
  ) => Promise<void>;
  onReturnTask: (taskId: string) => Promise<void>;
  returningId: string | null;
  savingFeedback: boolean;
}

const QUICK_REACTIONS = ["👍", "🌟", "💪", "🎉", "❤️", "🔥"];

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

const ANSWER_TYPE_LABELS: Record<string, string> = {
  text: "Tekstsvar",
  radio: "Flervalg (én riktig)",
  checkbox: "Flervalg (flere riktige)",
};

export default function ActivityDetailSheet({
  activity,
  isOpen,
  onClose,
  onSaveFeedback,
  onReturnTask,
  returningId,
  savingFeedback,
}: ActivityDetailSheetProps) {
  const [feedbackComment, setFeedbackComment] = useState(
    activity?.feedback?.teacher_comment ?? "",
  );

  // Sync comment input when activity changes (e.g. opening a different sheet)
  useEffect(() => {
    setFeedbackComment(activity?.feedback?.teacher_comment ?? "");
  }, [activity?.id, activity?.feedback?.teacher_comment]);

  if (!activity) return null;

  const studentName = activity.student?.full_name || "Ukjent elev";
  const studentInitial = studentName.charAt(0).toUpperCase();
  const isQuiz = activity.type === "quiz" && activity.quiz_data;

  const handleSendComment = async () => {
    const commentToSave = feedbackComment;
    await onSaveFeedback(activity.id, undefined, commentToSave);
    // Don't clear — the useEffect will sync from updated activity.feedback.teacher_comment
  };

  const handleReturn = async () => {
    await onReturnTask(activity.id);
    onClose();
  };

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
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg sm:max-w-[50vw] bg-white shadow-2xl flex flex-col"
          >
            {/* ── Header ──────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {activity.student?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activity.student.avatar_url}
                    alt={studentName}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                    {studentInitial}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 truncate">
                    {studentName}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {activity.subject && (
                      <span>
                        {activity.subject.emoji} {activity.subject.title}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(activity.completed_at)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
              >
                <X className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            {/* ── Scrollable Content ──────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {/* Task Info Section */}
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Oppgave
                  </h3>
                  {activity.points_value > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                      ⭐ {activity.points_value} poeng
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-semibold text-slate-900 mb-1">
                  {activity.title}
                </h4>

                {activity.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activity.description}
                  </p>
                )}

                {/* Quiz Questions with Inline Responses */}
                {isQuiz && activity.quiz_data && (
                  <div className="mt-4 space-y-3">
                    {activity.quiz_data.map((q, idx) => {
                      const raw = activity.feedback?.quiz_responses?.[q.id];

                      // Handle both old flat format (string | string[]) and
                      // new enriched format ({ answer, audioUrl? })
                      let answer: string | string[] | undefined;
                      let questionAudioUrl: string | undefined;

                      if (
                        raw &&
                        typeof raw === "object" &&
                        !Array.isArray(raw) &&
                        "answer" in raw
                      ) {
                        // New enriched format
                        answer = raw.answer;
                        questionAudioUrl = raw.audioUrl;
                      } else {
                        // Old flat format
                        answer = raw as string | string[] | undefined;
                      }

                      const isChoiceQuestion =
                        q.answerType === "radio" || q.answerType === "checkbox";
                      const selectedSet = new Set(
                        answer
                          ? Array.isArray(answer)
                            ? answer
                            : [answer]
                          : [],
                      );

                      return (
                        <div
                          key={q.id}
                          className="rounded-lg border border-slate-100 overflow-hidden"
                        >
                          {/* Question + inline options */}
                          <div className="bg-slate-50 p-3">
                            <div className="flex items-start gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">
                                  {q.text}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {ANSWER_TYPE_LABELS[q.answerType] ||
                                    q.answerType}
                                </p>

                                {/* Choice options — colour-coded by selection */}
                                {isChoiceQuestion && q.options.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {q.options.map((opt, i) => {
                                      const isSelected = selectedSet.has(opt);
                                      return (
                                        <span
                                          key={i}
                                          className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                            isSelected
                                              ? "bg-green-100 text-green-800 border border-green-300"
                                              : "bg-white text-slate-500 border border-slate-200"
                                          }`}
                                        >
                                          {isSelected && "✓ "}
                                          {opt}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* No answer indicator for choice questions (only if no audio either) */}
                                {isChoiceQuestion &&
                                  selectedSet.size === 0 &&
                                  !questionAudioUrl && (
                                    <p className="mt-1.5 text-xs text-slate-400 italic">
                                      Ikke besvart
                                    </p>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Text answer — only for text-type questions */}
                          {q.answerType === "text" && (
                            <div className="bg-green-50 px-3 py-2.5 border-t border-green-100">
                              <div className="flex items-start gap-2 pl-7">
                                {answer &&
                                typeof answer === "string" &&
                                answer.trim() ? (
                                  <p className="text-sm text-green-800 font-medium">
                                    {answer}
                                  </p>
                                ) : !questionAudioUrl ? (
                                  <p className="text-sm text-slate-400 italic">
                                    Ikke besvart
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          )}

                          {/* Per-question audio answer */}
                          {questionAudioUrl && (
                            <div className="bg-blue-50 px-3 py-2.5 border-t border-blue-100">
                              <div className="flex items-center gap-2 pl-7">
                                <span className="text-xs text-blue-600 font-medium">
                                  Muntlig svar:
                                </span>
                                <audio
                                  controls
                                  src={questionAudioUrl}
                                  className="h-8 flex-1"
                                  preload="metadata"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Student Extras (comment, audio, image) ── */}
              {(activity.feedback?.student_comment ||
                activity.feedback?.student_audio_url ||
                activity.feedback?.student_image_url ||
                (!isQuiz &&
                  !activity.feedback?.quiz_responses &&
                  !activity.feedback?.student_comment &&
                  !activity.feedback?.student_audio_url &&
                  !activity.feedback?.student_image_url)) && (
                <div className="px-6 py-5 border-b border-slate-100">
                  {/* Only show header when there's actual extra content */}
                  {(activity.feedback?.student_comment ||
                    activity.feedback?.student_audio_url ||
                    activity.feedback?.student_image_url) && (
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                        Elevens kommentar
                      </h3>
                    </div>
                  )}

                  {/* Text comment */}
                  {activity.feedback?.student_comment ? (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 mb-4">
                      <p className="text-sm text-slate-700 italic leading-relaxed">
                        &ldquo;{activity.feedback.student_comment}&rdquo;
                      </p>
                    </div>
                  ) : !isQuiz &&
                    !activity.feedback?.student_audio_url &&
                    !activity.feedback?.student_image_url ? (
                    <p className="text-sm text-slate-400 italic">
                      Ingen besvarelse levert
                    </p>
                  ) : null}

                  {/* Audio */}
                  {activity.feedback?.student_audio_url && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">
                          Lydopptak
                        </span>
                      </div>
                      <audio
                        controls
                        src={activity.feedback.student_audio_url}
                        className="w-full h-10"
                      />
                    </div>
                  )}

                  {/* Image */}
                  {activity.feedback?.student_image_url && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">
                          Bilde
                        </span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activity.feedback.student_image_url}
                        alt="Elevens bilde"
                        className="rounded-lg border border-slate-200 max-h-96 w-auto object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Existing Teacher Feedback Display ──── */}
              {(activity.feedback?.teacher_reaction ||
                activity.feedback?.teacher_comment) && (
                <div className="px-6 py-5 border-b border-slate-100 bg-indigo-50/30">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Din tilbakemelding
                  </h3>
                  <div className="flex items-center gap-3">
                    {activity.feedback.teacher_reaction && (
                      <span className="text-2xl">
                        {activity.feedback.teacher_reaction}
                      </span>
                    )}
                    {activity.feedback.teacher_comment && (
                      <p className="text-sm text-slate-700 italic">
                        {activity.feedback.teacher_comment}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer: Actions ─────────────────────── */}
            <div className="border-t border-slate-200 bg-slate-50 shrink-0">
              {/* Quick reactions */}
              <div className="px-6 pt-4 pb-2">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Hurtigreaksjon
                </p>
                <div className="flex gap-1">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() =>
                        onSaveFeedback(activity.id, emoji, undefined)
                      }
                      disabled={savingFeedback}
                      className={`text-xl p-2 rounded-lg transition-colors ${
                        activity.feedback?.teacher_reaction === emoji
                          ? "bg-indigo-100 ring-2 ring-indigo-400"
                          : "hover:bg-slate-200"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment input */}
              <div className="px-6 pb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Skriv en kommentar..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !savingFeedback) {
                        handleSendComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={savingFeedback || !feedbackComment.trim()}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-4 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Lukk
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-100 transition-colors text-sm">
                      <Undo2 className="h-4 w-4" />
                      Send i retur
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send oppgave i retur?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Oppgaven &ldquo;{activity.title}&rdquo; blir satt
                        tilbake til ugjort
                        {activity.points_value > 0 &&
                          ` og ${activity.points_value} poeng trekkes fra ${studentName}`}
                        .
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={handleReturn}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
