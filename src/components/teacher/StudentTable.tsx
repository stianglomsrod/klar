"use client";

import { MoreVertical } from "lucide-react";
import { useState, useEffect } from "react";

type Student = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  class_id: string | null;
  show_flower_garden: boolean;
  custom_welcome_message: string | null;
};

type StudentTableProps = {
  students: Student[];
  onEditStudent: (student: Student) => void;
};

type DropdownPosition = {
  x: number;
  y: number;
};

export default function StudentTable({
  students,
  onEditStudent,
}: StudentTableProps) {
  const [openMenu, setOpenMenu] = useState<{
    studentId: string;
    position: DropdownPosition;
  } | null>(null);

  const handleMenuClick = (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({
      studentId,
      position: { x: rect.right - 180, y: rect.bottom + 5 },
    });
  };

  const handleMenuAction = (action: string, student: Student) => {
    setOpenMenu(null);

    switch (action) {
      case "edit":
        onEditStudent(student);
        break;
      case "view-profile":
        console.log("View student profile", student.id);
        break;
      case "move-student":
        console.log("Move student", student.id);
        break;
      case "remove-student":
        console.log("Remove student", student.id);
        break;
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null);
    if (openMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenu]);

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
                className="hover:bg-slate-50 transition-colors"
              >
                {/* Student Name & Avatar */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-sm flex-shrink-0">
                      {student.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
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
                    onClick={(e) => handleMenuClick(e, student.id)}
                    className="inline-flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu Dropdown */}
      {openMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]"
          style={{ top: openMenu.position.y, left: openMenu.position.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const student = students.find((s) => s.id === openMenu.studentId);
            if (!student) return null;

            return (
              <>
                <button
                  onClick={() => handleMenuAction("edit", student)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Rediger
                </button>
                <button
                  onClick={() => handleMenuAction("view-profile", student)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  View Profile
                </button>
                <button
                  onClick={() => handleMenuAction("move-student", student)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Move Student
                </button>
                <div className="border-t border-slate-200 my-1" />
                <button
                  onClick={() => handleMenuAction("remove-student", student)}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Remove Student
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
