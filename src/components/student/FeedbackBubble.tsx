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
  /** Pre-resolved display name from resolveTeacherNames – falls back to full_name */
  displayName?: string;
}

// ── Component ────────────────────────────────────────
export default function FeedbackBubble({
  feedback,
  displayName,
}: FeedbackBubbleProps) {
  const hasReaction = !!feedback.teacher_reaction;
  const hasComment = !!feedback.teacher_comment;
  const isUnread = !feedback.read_at;

  // Nothing to show if teacher hasn't left any feedback
  if (!hasReaction && !hasComment) return null;

  const teacherName = displayName || feedback.teacher?.full_name || "Lærer";
  const teacherInitial = (feedback.teacher?.full_name || "L")
    .charAt(0)
    .toUpperCase();

  // Case A: Emoji only (no text comment)
  const isEmojiOnly = hasReaction && !hasComment;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* ── Teacher avatar + name (left-aligned) ── */}
      <div className="flex items-center gap-2.5 mb-2">
        {feedback.teacher?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={feedback.teacher.avatar_url}
            alt={teacherName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-white/80 shadow-sm"
          />
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-200/60 text-amber-800 text-sm font-bold">
            {teacherInitial}
          </div>
        )}
        <span className="text-sm font-semibold text-amber-900">
          {teacherName}
        </span>
        {isUnread && (
          <motion.span
            animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-amber-400 text-xs"
            title="Ny tilbakemelding"
          >
            ✨
          </motion.span>
        )}
      </div>

      {isEmojiOnly ? (
        /* ── Case A: Emoji-only sticker ── */
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl"
        >
          <span className="text-4xl">{feedback.teacher_reaction}</span>
        </motion.div>
      ) : (
        /* ── Case B: Text + inline TTS, emoji sticker bottom-right ── */
        <div className="pr-10">
          <div className="flex items-center gap-2">
            <p className="text-[15px] text-amber-950 leading-relaxed">
              {feedback.teacher_comment}
            </p>
            <TTSButton
              text={feedback.teacher_comment!}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      )}

      {/* Emoji "sticker" — stamped bottom-right of the card */}
      {hasReaction && !isEmojiOnly && (
        <motion.span
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 8 }}
          transition={{
            type: "spring",
            damping: 10,
            stiffness: 250,
            delay: 0.15,
          }}
          className="absolute bottom-0 right-0 text-2xl select-none"
        >
          {feedback.teacher_reaction}
        </motion.span>
      )}
    </motion.div>
  );
}
