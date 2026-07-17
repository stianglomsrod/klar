"use client";

import { GraduationCap, Plus, Loader2, X } from "lucide-react";

function inferGradeFromInput(className: string): string {
  const match = className.match(/^(\d+)/);
  return match ? `${match[1]}. Trinn` : "Annet";
}

type CreateClassDialogProps = {
  newClassName: string;
  setNewClassName: (v: string) => void;
  gradeHint: string | null;
  creating: boolean;
  onSubmit: () => void;
  onClose: () => void;
};

export default function CreateClassDialog({
  newClassName,
  setNewClassName,
  gradeHint,
  creating,
  onSubmit,
  onClose,
}: CreateClassDialogProps) {
  const displayedGrade = gradeHint || inferGradeFromInput(newClassName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            Opprett klasse
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Klassenavn
            </label>
            <input
              type="text"
              placeholder='F.eks. "5A", "6B"'
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newClassName.trim()) onSubmit();
              }}
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {newClassName.trim() && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
              Trinn:{" "}
              <span className="font-medium text-slate-900">
                {displayedGrade}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={onSubmit}
            disabled={!newClassName.trim() || creating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Opprett
          </button>
        </div>
      </div>
    </div>
  );
}
