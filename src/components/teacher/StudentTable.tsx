"use client";

import { MoreVertical, ArrowUpDown } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

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
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [openMenu, setOpenMenu] = useState<{
    studentId: string;
    position: DropdownPosition;
  } | null>(null);

  const handleMenuClick = useCallback(
    (e: React.MouseEvent, studentId: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setOpenMenu({
        studentId,
        position: { x: rect.right - 180, y: rect.bottom + 5 },
      });
    },
    []
  );

  const handleMenuAction = useCallback(
    (action: string, student: Student) => {
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
    },
    [onEditStudent]
  );

  // Define columns
  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: ({ column }) => {
          return (
            <button
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="flex items-center gap-2 hover:text-slate-900 transition-colors"
            >
              Elev
              <ArrowUpDown className="h-4 w-4" />
            </button>
          );
        },
        cell: ({ row }) => {
          const student = row.original;
          return (
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
          );
        },
      },
      {
        accessorKey: "class_name",
        header: ({ column }) => {
          return (
            <button
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="flex items-center gap-2 hover:text-slate-900 transition-colors"
            >
              Klasse
              <ArrowUpDown className="h-4 w-4" />
            </button>
          );
        },
        cell: ({ row }) => {
          const className = row.getValue("class_name") as string | null;
          return className ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {className}
            </span>
          ) : (
            <span className="text-sm text-slate-400">Ingen klasse</span>
          );
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) as string | null;
          const b = rowB.getValue(columnId) as string | null;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "level",
        header: ({ column }) => {
          return (
            <button
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="flex items-center gap-2 hover:text-slate-900 transition-colors"
            >
              Nivå
              <ArrowUpDown className="h-4 w-4" />
            </button>
          );
        },
        cell: ({ row }) => {
          const level = row.getValue("level") as number;
          return (
            <span className="text-sm font-medium text-slate-700">
              Lvl {level}
            </span>
          );
        },
        sortingFn: "basic", // Numeric sorting
      },
      {
        accessorKey: "show_flower_garden",
        header: ({ column }) => {
          return (
            <button
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="flex items-center gap-2 hover:text-slate-900 transition-colors"
            >
              Modus
              <ArrowUpDown className="h-4 w-4" />
            </button>
          );
        },
        cell: ({ row }) => {
          const showGarden = row.getValue("show_flower_garden") as boolean;
          return showGarden ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              🌱 Hage
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              🏆 Kun Poeng
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Handlinger</div>,
        cell: ({ row }) => {
          const student = row.original;
          return (
            <div className="text-right">
              <button
                onClick={(e) => handleMenuClick(e, student.id)}
                className="inline-flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="More actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [handleMenuClick]
  );

  // eslint-disable-next-line react-compiler/react-compiler
  const table = useReactTable({
    data: students,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() =>
                  router.push(`/teacher/students/${row.original.id}`)
                }
                className="hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
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
