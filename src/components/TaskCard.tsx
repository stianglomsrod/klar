"use client";

import { CheckCircle } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  type: string;
  is_completed: boolean;
};

type TaskCardProps = {
  task: Task;
  onComplete: () => void;
  colorTheme?: string; // Optional: color theme for the subject this task belongs to (used by parent for styling)
};

export default function TaskCard({
  task,
  onComplete,
  colorTheme = "blue",
}: TaskCardProps) {
  const isDone = task.is_completed;

  return (
    <div className="h-full bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-1">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
            {task.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {task.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {task.type === "quiz" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
              Quiz
            </span>
          )}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
            {task.points_value} poeng
          </span>
        </div>
      </div>

      {isDone ? (
        <div className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 font-semibold">
          Fullført! ✅
        </div>
      ) : (
        <button
          onClick={onComplete}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-wide py-4 px-6 rounded-xl shadow-md border-b-4 active:translate-y-[1px] active:border-b-2 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            borderBottomColor: `currentColor`,
            opacity: 0.9,
          }}
        >
          <CheckCircle className="h-5 w-5" />
          Fullfør
        </button>
      )}
    </div>
  );
}
