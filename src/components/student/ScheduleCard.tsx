"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import MissionChip from "@/components/student/MissionChip";
import LessonProgress from "@/components/student/LessonProgress";
import { getSubjectTheme } from "@/utils/subject-colors";
import { formatTime } from "@/utils/format-time";

/* ── Types ─────────────────────────────────────────────── */

export type ScheduleEntry = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  subject_title: string;
  emoji: string;
  subject_color: string;
  entry_has_tasks: boolean;
  subject_has_tasks: boolean;
  custom_title: string | null;
  tasks_total: number;
  tasks_completed: number;
};

export type LessonState = "upcoming" | "active" | "finished";

export type ScheduleCardProps = {
  entry: ScheduleEntry;
  state: LessonState;
  /** Whether this card is centered in the fisheye scroll */
  isCentered: boolean;
  /** Zero-based position index in the schedule list */
  index: number;
  /** Navigate / action handler */
  onClick: () => void;
  /** Real-time lesson-elapsed percentage (0–100) */
  lessonProgress: number;
  /** Ref forwarded to the active-lesson card for auto-scroll */
  activeRef?: React.Ref<HTMLButtonElement>;
};

/* ── Component ─────────────────────────────────────────── */

export default function ScheduleCard({
  entry,
  state,
  isCentered,
  index,
  onClick,
  lessonProgress,
  activeRef,
}: ScheduleCardProps) {
  const isLiveLesson = state === "active";
  const isFinished = state === "finished";

  /* Resolve styles from the centralized colour map */
  const theme = getSubjectTheme(entry.subject_color);
  const accentColor = `rgb(${theme.shadowRgb})`;

  /* Fisheye transforms — finished cards get less dimming for readability */
  const scale = isCentered ? 1.1 : 0.9;
  const opacity = isCentered ? 1 : isFinished ? 0.85 : 0.5;

  /* Labels */
  const subjectTitle = entry.subject_title || "Time";
  const secondaryLabel = entry.custom_title
    ? entry.custom_title
    : `${index + 1}. time`;

  /* Glow on active lessons */
  const glowStyle = isLiveLesson
    ? {
        boxShadow: `0 20px 25px -5px rgba(${theme.shadowRgb}, 0.4), 0 8px 10px -6px rgba(${theme.shadowRgb}, 0.2)`,
      }
    : undefined;

  return (
    <motion.button
      ref={activeRef}
      data-card
      data-id={entry.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onClick}
      style={{
        transform: `scale(${scale})`,
        opacity,
        filter: "blur(0px)",
      }}
      className={`group relative w-full text-left transition-all duration-300 ease-out snap-center cursor-pointer ${
        isCentered ? "z-10" : "z-0"
      } ${!isCentered ? "hover:opacity-100 hover:scale-95" : ""}`}
    >
      <div
        style={glowStyle}
        className={`relative flex items-center gap-4 p-6 rounded-3xl border-l-8 ${isFinished ? "border-slate-300" : theme.borderAccent} transition-all duration-300 ${
          isCentered
            ? isFinished
              ? "bg-slate-50 shadow-sm"
              : "bg-white shadow-2xl"
            : isFinished
              ? "bg-slate-100/80"
              : "bg-white/70"
        } ${isLiveLesson ? "animate-float" : ""}`}
      >
        {/* Left: Large Emoji */}
        <div className="flex-shrink-0">
          <span
            className={`transition-all duration-300 ${
              isCentered ? "text-6xl" : "text-3xl"
            }`}
          >
            {entry.emoji}
          </span>
        </div>

        {/* Middle: Subject Title + Time */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-0">
            <h3
              className={`font-bold leading-tight truncate transition-all duration-300 ${
                isCentered
                  ? isFinished
                    ? "text-3xl text-slate-500"
                    : "text-3xl text-slate-900"
                  : isFinished
                    ? "text-lg text-slate-500"
                    : "text-lg text-slate-700"
              }`}
            >
              {subjectTitle}
            </h3>
            {entry.tasks_total > 0 && (
              <MissionChip
                completed={entry.tasks_completed}
                total={entry.tasks_total}
                color={entry.subject_color}
                isActive={isCentered}
              />
            )}
          </div>

          <p className="text-sm text-slate-500 truncate">{secondaryLabel}</p>

          <p className="text-xs text-slate-500 font-medium">
            {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
          </p>
        </div>

        {/* Right: Status indicator */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {isFinished ? (
            <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm bg-green-50">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
          ) : isLiveLesson ? (
            <LessonProgress progress={lessonProgress} color={accentColor} />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center opacity-70" />
          )}
        </div>
      </div>
    </motion.button>
  );
}
