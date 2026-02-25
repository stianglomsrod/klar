"use client";

export type LessonProgressProps = {
  /** Progress percentage (0–100) */
  progress: number;
  /** Accent color as a CSS color string (e.g. "rgb(59, 130, 246)") */
  color: string;
};

/**
 * Circular SVG progress ring for active lessons.
 * Shows real-time lesson progress on the student dashboard and schedule cards.
 */
export default function LessonProgress({ progress, color }: LessonProgressProps) {
  const size = 44;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="w-12 h-12 flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="-rotate-90 drop-shadow-sm"
        role="presentation"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
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
    </div>
  );
}
