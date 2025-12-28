"use client";

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  type: string;
};

type TaskCardProps = {
  task: Task;
  onComplete: () => void;
};

export default function TaskCard({ task, onComplete }: TaskCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4 hover:shadow-xl transition-shadow border border-gray-100">
      {/* Task Type Badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
          {task.type}
        </span>
        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          <span className="text-amber-600 font-bold text-sm">
            {task.points_value}
          </span>
          <span className="text-amber-600 text-xs font-medium">pts</span>
        </div>
      </div>

      {/* Task Content */}
      <div className="flex-1">
        <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
          {task.title}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed">
          {task.description}
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={onComplete}
        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 active:scale-[0.98]"
      >
        Lever oppgave 🚀
      </button>
    </div>
  );
}
