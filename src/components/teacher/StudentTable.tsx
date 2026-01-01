"use client";

import { Pencil } from "lucide-react";

type Student = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  show_flower_garden: boolean;
  custom_welcome_message: string | null;
};

type StudentTableProps = {
  students: Student[];
  onEditStudent: (student: Student) => void;
};

export default function StudentTable({
  students,
  onEditStudent,
}: StudentTableProps) {
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="text-center py-12">
          <p className="text-slate-500">Ingen elever funnet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Elev
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Klasse
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Nivå
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Modus
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Handlinger
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((student) => (
              <tr
                key={student.id}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onEditStudent(student)}
              >
                {/* Student Name & Avatar */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-sm flex-shrink-0">
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={student.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        student.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {student.full_name}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Class */}
                <td className="px-6 py-4">
                  {student.class_name ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {student.class_name}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Ingen klasse</span>
                  )}
                </td>

                {/* Level */}
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-slate-700">
                    Lvl {student.level}
                  </span>
                </td>

                {/* Mode */}
                <td className="px-6 py-4">
                  {student.show_flower_garden ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      🌱 Hage
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      🏆 Kun Poeng
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditStudent(student);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    Rediger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
