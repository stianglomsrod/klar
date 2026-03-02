"use client";

import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { isImageUrl } from "@/utils/avatar";
import type { Student } from "./types";

type StudentRowProps = {
  student: Student;
  /** Fallback class name shown when student.class_name is null */
  fallbackClassName: string;
  onMenuClick: (
    e: React.MouseEvent,
    type: "student",
    id: string,
    student: Student,
  ) => void;
};

export default function StudentRow({
  student,
  fallbackClassName,
  onMenuClick,
}: StudentRowProps) {
  const router = useRouter();

  return (
    <div className="w-full px-4 py-2 pl-20 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
      <button
        onClick={() => router.push(`/teacher/students/${student.id}`)}
        className="flex-1 flex items-center gap-3 text-left"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xs flex-shrink-0">
          {isImageUrl(student.avatar_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.avatar_url}
              alt={student.full_name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-base">
              {student.avatar_url ||
                student.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {student.full_name}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
              {student.class_name || fallbackClassName}
            </span>
            <span>•</span>
            <span>Nivå {student.level}</span>
            <span>•</span>
            <span>
              {student.show_flower_garden ? "🌱 Hage" : "🏆 Poeng"}
            </span>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMenuClick(e, "student", student.id, student);
        }}
        className="ml-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
        title="More actions"
      >
        <MoreVertical className="h-4 w-4 text-slate-600" />
      </button>
    </div>
  );
}
