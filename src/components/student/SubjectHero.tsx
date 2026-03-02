"use client";

import { type ReactNode } from "react";
import SubjectProgress from "@/components/student/SubjectProgress";
import { getSubjectTheme } from "@/utils/subject-colors";
import { getHeroGradient } from "@/utils/hero-gradients";

// ── Types ────────────────────────────────────────────

type SubjectHeroProps = {
  emoji: string;
  title: string;
  colorTheme: string;
  completedCount: number;
  totalTasks: number;
  /** Optional subtitle line (e.g. time slot "08:30 – 09:15") */
  subtitle?: string;
  /**
   * Slot for extra content positioned inside the hero card.
   * Used by Container A for the archive button.
   */
  children?: ReactNode;
};

// ── Component ────────────────────────────────────────

/**
 * Shared hero banner for subject/lesson pages.
 *
 * Renders the gradient card with emoji, title, optional subtitle,
 * and a progress pill. Used by both Container A (`subject/[id]`)
 * and Container B (`lesson/[id]`).
 */
export default function SubjectHero({
  emoji,
  title,
  colorTheme,
  completedCount,
  totalTasks,
  subtitle,
  children,
}: SubjectHeroProps) {
  const theme = getSubjectTheme(colorTheme || "gray");

  return (
    <section className="pb-2 pt-3">
      <div
        className="w-full text-center rounded-3xl shadow-sm px-4 py-5 md:py-6 flex flex-col items-center relative"
        style={{ background: getHeroGradient(colorTheme) }}
      >
        {children}

        {/* Subject Icon */}
        <div className="flex justify-center mb-2 md:mb-3">
          <div className="text-6xl drop-shadow-md animate-bounce-settle">
            {emoji}
          </div>
        </div>

        {/* Subject Title */}
        <h1
          className={`text-3xl font-extrabold tracking-tight md:text-4xl mb-2 ${theme.text}`}
        >
          {title}
        </h1>

        {/* Subtitle (optional) */}
        {subtitle && (
          <p className="text-sm text-gray-600 font-medium mb-1">{subtitle}</p>
        )}

        {/* Progress Pill */}
        {totalTasks > 0 && (
          <SubjectProgress
            completed={completedCount}
            total={totalTasks}
            colorTheme={colorTheme}
          />
        )}
      </div>
    </section>
  );
}
