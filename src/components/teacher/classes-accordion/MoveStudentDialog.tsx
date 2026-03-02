"use client";

import { X } from "lucide-react";
import ClassCombobox from "../ClassCombobox";

type MoveStudentDialogProps = {
  studentId: string;
  studentName: string;
  currentClassName: string | null;
  onMoved: (newClassName: string) => void;
  onClose: () => void;
};

export default function MoveStudentDialog({
  studentId,
  studentName,
  currentClassName,
  onMoved,
  onClose,
}: MoveStudentDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Flytt {studentName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {currentClassName && (
          <p className="text-sm text-slate-500 mb-3">
            Nåværende klasse:{" "}
            <span className="font-medium text-slate-700">
              {currentClassName}
            </span>
          </p>
        )}

        <p className="text-sm text-slate-600 mb-3">Velg ny klasse:</p>

        <ClassCombobox
          studentId={studentId}
          initialClassName={currentClassName}
          onClassChanged={(newClassName) => {
            onMoved(newClassName);
          }}
        />
      </div>
    </div>
  );
}
