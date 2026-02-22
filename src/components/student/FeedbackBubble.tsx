"use client";

import { motion } from "framer-motion";
import TTSButton from "@/components/ui/TTSButton";

// ── Types ────────────────────────────────────────────
export type FeedbackData = {
  teacher_reaction: string | null;
  teacher_comment: string | null;
  read_at: string | null;
  teacher?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface FeedbackBubbleProps {
  feedback: FeedbackData;
}

// ── Component ────────────────────────────────────────
export default function FeedbackBubble({ feedback }: FeedbackBubbleProps) {
  const hasReaction = !!feedback.teacher_reaction;
  const hasComment = !!feedback.teacher_comment;
  const isUnread = !feedback.read_at;

  // Nothing to show if teacher hasn't left any feedback
  if (!hasReaction && !hasComment) return null;

  const teacherName = feedback.teacher?.full_name || "Lærer";
  const teacherInitial = teacherName.charAt(0).toUpperCase();

  // Case A: Emoji only (no text comment)
  const isEmojiOnly = hasReaction && !hasComment;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3"
    >
      {/* ── Teacher attribution header ── */}
      <div className="flex items-center gap-2 mb-1.5">
        {feedback.teacher?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={feedback.teacher.avatar_url}
            alt={teacherName}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
            {teacherInitial}
          </div>
        )}
        <span className="text-xs font-semibold text-slate-600">
          {teacherName}
        </span>

        {/* "New" indicator — animated star */}
        {isUnread && (
          <motion.span
            animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-amber-400 text-sm"
            title="Ny tilbakemelding"
          >
            ✨
          </motion.span>
        )}
      </div>

      {isEmojiOnly ? (
        /* ── Case A: Emoji-only "sticker" ── */
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100"
        >
          <span className="text-3xl">{feedback.teacher_reaction}</span>
        </motion.div>
      ) : (
        /* ── Case B: Text + optional emoji badge ── */
        <div className="relative inline-block max-w-[85%]">
          {/* Speech bubble */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-700 leading-relaxed flex-1">
                {feedback.teacher_comment}
              </p>
              <TTSButton
                text={feedback.teacher_comment!}
                className="shrink-0"
              />
            </div>
          </div>

          {/* Emoji reaction badge — overlapping bottom-right corner */}
          {hasReaction && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                damping: 12,
                stiffness: 300,
                delay: 0.2,
              }}
              className="absolute -bottom-2 -right-2 flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-indigo-100 shadow-sm text-base"
            >
              {feedback.teacher_reaction}
            </motion.span>
          )}
        </div>
      )}
    </motion.div>
  );
}
