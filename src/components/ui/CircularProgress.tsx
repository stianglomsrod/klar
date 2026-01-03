"use client";

type CircularProgressProps = {
  size?: number;
  strokeWidth?: number;
  percentage: number;
  color?: string;
  text?: string;
};

export default function CircularProgress({
  size = 80,
  strokeWidth = 6,
  percentage,
  color = "#6366f1", // indigo-500 default
  text = "",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center Text */}
      {text && (
        <div className="absolute inset-0 flex items-center justify-center">
          {(() => {
            // Try to split number from unit (e.g., "22 min" -> "22" + "min")
            const match = text.match(/^(\d+)\s*(.*)$/);
            if (match) {
              const [, number, unit] = match;
              return (
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-3xl font-black text-gray-900">{number}</span>
                  {unit && (
                    <span className="text-xs font-medium text-gray-500 mt-0.5">{unit}</span>
                  )}
                </div>
              );
            }
            // Fallback: render as single text
            return <span className="text-xl font-bold text-gray-900">{text}</span>;
          })()}
        </div>
      )}
    </div>
  );
}
