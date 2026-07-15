"use client";

import { ListTodo } from "lucide-react";

export type MissionChipProps = {
  completed: number;
  total: number;
  /** Subject color key — unused for chip color logic but kept for future theming */
  color?: string;
  /** Whether the card is visually emphasized (centered in fisheye, or active) */
  isActive?: boolean;
};

/**
 * Small pill showing task completion progress (e.g. "2/4").
 * Green when all tasks completed, gray otherwise.
 * Reusable on ScheduleCard, Timeplan cards, etc.
 */
export default function MissionChip({
  completed,
  total,
  isActive = false,
}: MissionChipProps) {
  const isAllTasksCompleted = completed >= total;

  const bgClass = isAllTasksCompleted
    ? isActive
      ? "bg-emerald-500"
      : "bg-emerald-100"
    : isActive
      ? "bg-gray-600"
      : "bg-gray-100";

  const textClass = isAllTasksCompleted
    ? isActive
      ? "text-white"
      : "text-emerald-700"
    : isActive
      ? "text-white"
      : "text-gray-600";

  return (
    <div
      className={`ml-3 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${bgClass} ${textClass} ${
        isActive ? "shadow-sm" : ""
      }`}
    >
      <ListTodo className="h-3.5 w-3.5" />
      <span>
        {completed}/{total}
      </span>
    </div>
  );
}
