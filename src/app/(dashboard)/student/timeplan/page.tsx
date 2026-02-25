"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, PanInfo } from "framer-motion";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { getISOWeekNumber, getISODayOfWeek } from "@/utils/week-number";
import { formatTime } from "@/utils/format-time";
import { getSubjectTheme } from "@/utils/subject-colors";
import MissionChip from "@/components/student/MissionChip";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ScheduleEntry } from "@/components/student/ScheduleCard";

/* ── Constants ─────────────────────────────────────────── */

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"] as const;
const DAY_NAMES_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre"] as const;
const SWIPE_THRESHOLD = 50; // px to count as a swipe

/* ── Helpers ───────────────────────────────────────────── */

type LessonState = "upcoming" | "active" | "finished";

function getLessonState(startTime: string, endTime: string): LessonState {
  const now = new Date();
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startDate = new Date();
  startDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date();
  endDate.setHours(endHour, endMin, 0, 0);

  if (now < startDate) return "upcoming";
  if (now >= startDate && now < endDate) return "active";
  return "finished";
}

function getLessonProgressPercent(
  startTime: string,
  endTime: string,
  now: Date,
): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startDate = new Date(now);
  startDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(endHour, endMin, 0, 0);

  const total = endDate.getTime() - startDate.getTime();
  if (total <= 0) return 0;

  const elapsed = now.getTime() - startDate.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

/* ── Page Component ────────────────────────────────────── */

export default function StudentTimeplanPage() {
  const router = useRouter();
  const supabase = createClient();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const todayDayIndex = getISODayOfWeek(currentTime) - 1; // 0-based (0=Monday)
  const [selectedDay, setSelectedDay] = useState(Math.min(todayDayIndex, 4)); // clamp to Mon-Fri

  // Update time every 30s
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch full week schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const weekNumber = getISOWeekNumber(currentTime);

        const { data: scheduleData, error } = await supabase.rpc(
          "get_student_schedule",
          {
            p_student_id: user.id,
            p_current_week_number: weekNumber,
          },
        );

        if (error) {
          console.error("Failed to fetch schedule:", error);
          setSchedule([]);
        } else {
          const entries = (scheduleData || []).map(
            (entry: Record<string, unknown>) => ({
              ...entry,
              tasks_total: entry.tasks_total ?? 0,
              tasks_completed: entry.tasks_completed ?? 0,
              subject_color: entry.subject_color ?? "gray",
            }),
          );
          setSchedule(entries);
        }
      } catch (err) {
        console.error("Error in fetchSchedule:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group schedule by day_of_week (1=Monday … 5=Friday)
  const scheduleByDay: Record<number, ScheduleEntry[]> = {};
  for (let d = 1; d <= 5; d++) {
    scheduleByDay[d] = schedule
      .filter((e) => e.day_of_week === d)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const handleLessonClick = (entry: ScheduleEntry) => {
    router.push(`/student/lesson/${entry.id}`);
  };

  /* ── Swipe handling (mobile) ─────────────────────────── */

  const handleSwipe = (direction: "left" | "right") => {
    if (direction === "left" && selectedDay < 4) {
      setSelectedDay((d) => d + 1);
    } else if (direction === "right" && selectedDay > 0) {
      setSelectedDay((d) => d - 1);
    }
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x < -SWIPE_THRESHOLD) handleSwipe("left");
    else if (info.offset.x > SWIPE_THRESHOLD) handleSwipe("right");
  };

  /* ── Loading state ───────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    );
  }

  const weekNumber = getISOWeekNumber(currentTime);
  const isToday = (dayIdx: number) => dayIdx === todayDayIndex;

  /* ── Today's progress stats ──────────────────────────── */
  const todayEntries = scheduleByDay[todayDayIndex + 1] || [];
  const todayTotalTasks = todayEntries.reduce((s, e) => s + e.tasks_total, 0);
  const todayCompletedTasks = todayEntries.reduce(
    (s, e) => s + e.tasks_completed,
    0,
  );
  const todayAllDone =
    todayTotalTasks > 0 && todayCompletedTasks >= todayTotalTasks;

  /* ── Render ──────────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 pb-28">
      {/* Header */}
      <div className="pt-6 pb-2 text-center">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Uke {weekNumber}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Timeplan</h1>

        {/* Today's progress pill */}
        {todayTotalTasks > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-2 inline-flex items-center gap-1.5"
          >
            {todayAllDone ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Alle oppgaver fullført i dag! 🎉
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {todayCompletedTasks}/{todayTotalTasks} oppgaver fullført i dag
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* Day Tabs */}
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="flex justify-center gap-1 px-3 py-2 max-w-2xl mx-auto">
          {DAY_NAMES_SHORT.map((name, idx) => {
            const dayNum = idx + 1;
            const dayEntries = scheduleByDay[dayNum] || [];
            const allCompleted =
              dayEntries.length > 0 &&
              dayEntries.every(
                (e) => e.tasks_total > 0 && e.tasks_completed >= e.tasks_total,
              );

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx)}
                className={`relative flex-1 py-2 px-1 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  selectedDay === idx
                    ? "bg-indigo-600 text-white shadow-md"
                    : isToday(idx)
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {name}
                {/* Dot indicators */}
                <span className="block mt-0.5">
                  {dayEntries.length > 0 ? (
                    allCompleted ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    ) : isToday(idx) && selectedDay !== idx ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    ) : selectedDay === idx ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/70" />
                    ) : (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )
                  ) : (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-transparent" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Content */}
      {isDesktop ? (
        /* ── Desktop: Grid of all days ────────────────────── */
        <DesktopWeekGrid
          scheduleByDay={scheduleByDay}
          currentTime={currentTime}
          todayDayIndex={todayDayIndex}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onLessonClick={handleLessonClick}
        />
      ) : (
        /* ── Mobile: Swipeable single-day view ────────────── */
        <motion.div
          key={selectedDay}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
          className="px-4 pt-4 max-w-lg mx-auto touch-pan-y"
        >
          <DayHeader dayIndex={selectedDay} isToday={isToday(selectedDay)} />
          <DayScheduleList
            entries={scheduleByDay[selectedDay + 1] || []}
            currentTime={currentTime}
            isToday={isToday(selectedDay)}
            onLessonClick={handleLessonClick}
          />

          {/* Swipe hints */}
          <div className="flex justify-between items-center mt-6 px-4 text-slate-400 text-xs">
            {selectedDay > 0 ? (
              <span className="flex items-center gap-1">
                <ChevronLeft className="h-3 w-3" /> {DAY_NAMES[selectedDay - 1]}
              </span>
            ) : (
              <span />
            )}
            {selectedDay < 4 ? (
              <span className="flex items-center gap-1">
                {DAY_NAMES[selectedDay + 1]}{" "}
                <ChevronRight className="h-3 w-3" />
              </span>
            ) : (
              <span />
            )}
          </div>
        </motion.div>
      )}
    </main>
  );
}

/* ── Sub-components ────────────────────────────────────── */

/** Section header showing full day name */
function DayHeader({
  dayIndex,
  isToday,
}: {
  dayIndex: number;
  isToday: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-lg font-bold text-slate-800">
        {DAY_NAMES[dayIndex]}
      </h2>
      {isToday && (
        <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
          I dag
        </span>
      )}
    </div>
  );
}

/** List of schedule entries for a single day */
function DayScheduleList({
  entries,
  currentTime,
  isToday,
  onLessonClick,
}: {
  entries: ScheduleEntry[];
  currentTime: Date;
  isToday: boolean;
  onLessonClick: (entry: ScheduleEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">🏖️</span>
        <p className="text-slate-500 font-medium">Ingen timer denne dagen</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const state = isToday
          ? getLessonState(entry.start_time, entry.end_time)
          : "upcoming";
        const progress = isToday
          ? getLessonProgressPercent(
              entry.start_time,
              entry.end_time,
              currentTime,
            )
          : 0;

        return (
          <TimeplanCard
            key={entry.id}
            entry={entry}
            state={state}
            lessonProgress={progress}
            index={index}
            isToday={isToday}
            onClick={() => onLessonClick(entry)}
          />
        );
      })}
    </div>
  );
}

/** Individual card in the Timeplan (non-fisheye, flat layout) */
function TimeplanCard({
  entry,
  state,
  lessonProgress,
  index,
  onClick,
}: {
  entry: ScheduleEntry;
  state: LessonState;
  lessonProgress: number;
  index: number;
  isToday: boolean;
  onClick: () => void;
}) {
  const isLiveLesson = state === "active";
  const isFinished = state === "finished";
  const theme = getSubjectTheme(entry.subject_color);
  const accentRgb = theme.shadowRgb;

  const subjectTitle = entry.subject_title || "Time";
  const secondaryLabel = entry.custom_title
    ? entry.custom_title
    : `${index + 1}. time`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={onClick}
      className="w-full text-left"
    >
      <div
        style={
          isLiveLesson
            ? {
                boxShadow: `0 8px 20px -4px rgba(${accentRgb}, 0.35)`,
              }
            : undefined
        }
        className={`flex items-center gap-3 p-4 rounded-2xl border-l-[6px] ${theme.borderAccent} transition-all duration-200 ${
          isLiveLesson
            ? "bg-white shadow-lg ring-1 ring-slate-200"
            : isFinished
              ? "bg-slate-100/70"
              : "bg-white/80 shadow-sm"
        }`}
      >
        {/* Emoji */}
        <span
          className={`text-2xl flex-shrink-0 ${isFinished ? "opacity-50" : ""}`}
        >
          {entry.emoji}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3
              className={`font-bold text-base truncate ${
                isFinished ? "text-slate-400 line-through" : "text-slate-800"
              }`}
            >
              {subjectTitle}
            </h3>
            {isLiveLesson && (
              <span className="flex-shrink-0 text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                NÅ
              </span>
            )}
            {entry.tasks_total > 0 && (
              <MissionChip
                completed={entry.tasks_completed}
                total={entry.tasks_total}
                isActive={isLiveLesson}
              />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
            {secondaryLabel !== subjectTitle && (
              <span className="ml-2 text-slate-400">· {secondaryLabel}</span>
            )}
          </p>
        </div>

        {/* Status */}
        <div className="flex-shrink-0">
          {isFinished ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : isLiveLesson ? (
            <LiveIndicator
              progress={lessonProgress}
              color={`rgb(${accentRgb})`}
            />
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-200" />
          )}
        </div>
      </div>
    </motion.button>
  );
}

/** Small live-lesson ring indicator for the Timeplan cards */
function LiveIndicator({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference -
    (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div className="relative">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span
          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
          style={{ color }}
        />
      </span>
    </div>
  );
}

/* ── Desktop Week Grid ─────────────────────────────────── */

function DesktopWeekGrid({
  scheduleByDay,
  currentTime,
  todayDayIndex,
  onLessonClick,
}: {
  scheduleByDay: Record<number, ScheduleEntry[]>;
  currentTime: Date;
  todayDayIndex: number;
  selectedDay: number;
  onSelectDay: (d: number) => void;
  onLessonClick: (entry: ScheduleEntry) => void;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 grid grid-cols-5 gap-4">
      {DAY_NAMES.map((name, idx) => {
        const dayNum = idx + 1;
        const entries = scheduleByDay[dayNum] || [];
        const isTodayCol = idx === todayDayIndex;

        return (
          <div
            key={idx}
            className={`rounded-2xl p-3 transition-colors ${
              isTodayCol
                ? "bg-indigo-50/60 ring-1 ring-indigo-200"
                : "bg-white/50"
            }`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h3
                className={`text-sm font-bold ${isTodayCol ? "text-indigo-700" : "text-slate-600"}`}
              >
                {name}
              </h3>
              {isTodayCol && (
                <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                  I DAG
                </span>
              )}
            </div>

            {entries.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Ingen timer
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const state = isTodayCol
                    ? getLessonState(entry.start_time, entry.end_time)
                    : "upcoming";
                  const progress = isTodayCol
                    ? getLessonProgressPercent(
                        entry.start_time,
                        entry.end_time,
                        currentTime,
                      )
                    : 0;

                  return (
                    <DesktopLessonRow
                      key={entry.id}
                      entry={entry}
                      state={state}
                      progress={progress}
                      isToday={isTodayCol}
                      onClick={() => onLessonClick(entry)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Compact row for the desktop grid */
function DesktopLessonRow({
  entry,
  state,
  progress,
  onClick,
}: {
  entry: ScheduleEntry;
  state: LessonState;
  progress: number;
  isToday: boolean;
  onClick: () => void;
}) {
  const isLive = state === "active";
  const isFinished = state === "finished";
  const theme = getSubjectTheme(entry.subject_color);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 p-2 rounded-xl transition-all duration-200 ${
        isLive
          ? "bg-white shadow-md ring-1 ring-indigo-200"
          : isFinished
            ? "bg-slate-100/60 opacity-60"
            : "bg-white/70 hover:bg-white hover:shadow-sm"
      }`}
    >
      <span className="text-lg flex-shrink-0">{entry.emoji}</span>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-bold truncate ${isFinished ? "text-slate-400 line-through" : "text-slate-700"}`}
        >
          {entry.subject_title || "Time"}
        </p>
        <p className="text-[10px] text-slate-400">
          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
        </p>
      </div>
      <div className="flex-shrink-0">
        {isFinished ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : isLive ? (
          <LiveIndicator
            progress={progress}
            color={`rgb(${theme.shadowRgb})`}
          />
        ) : entry.tasks_total > 0 ? (
          <span className="text-[10px] font-bold text-slate-400">
            {entry.tasks_completed}/{entry.tasks_total}
          </span>
        ) : null}
      </div>
    </button>
  );
}
