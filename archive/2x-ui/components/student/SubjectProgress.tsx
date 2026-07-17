"use client";

import { getSubjectTheme } from "@/utils/subject-colors";

type SubjectProgressProps = {
  completed: number;
  total: number;
  /** Color theme key (e.g. "blue", "Matte", "red") */
  colorTheme: string;
};

/**
 * Progress pill showing "X / Y" completed tasks.
 * Reusable across the subject library page and the session page.
 */
export default function SubjectProgress({
  completed,
  total,
  colorTheme,
}: SubjectProgressProps) {
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const theme = getSubjectTheme(colorTheme);

  return (
    <div className="mt-2 w-32 h-6 bg-gray-200 rounded-full relative overflow-hidden shadow-inner">
      <div
        className={`absolute top-0 left-0 h-full ${theme.progress} transition-all duration-500 ease-out`}
        style={{ width: `${percent}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 z-10">
        {completed} / {total}
      </div>
    </div>
  );
}
