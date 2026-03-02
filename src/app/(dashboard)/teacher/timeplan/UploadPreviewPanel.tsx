"use client";

import { FileText, Pencil, Loader2, Save, X } from "lucide-react";
import type { ScheduleEntry } from "@/app/actions/parse-weekly-plan";
import PreviewScheduleGrid from "@/components/teacher/PreviewScheduleGrid";

// ── Props ──

type UploadPreviewPanelProps = {
  schedule: ScheduleEntry[];
  className: string;
  mode: "master" | "weekly";
  weekNumber: number;
  alsoSaveAsMasterplan: boolean;
  onAlsoSaveAsMasterplanChange: (checked: boolean) => void;
  isSaving: boolean;
  onEditEntry: (index: number) => void;
  onSave: () => void;
  onReset: () => void;
};

// ── Component ──

export default function UploadPreviewPanel({
  schedule,
  className,
  mode,
  weekNumber,
  alsoSaveAsMasterplan,
  onAlsoSaveAsMasterplanChange,
  isSaving,
  onEditEntry,
  onSave,
  onReset,
}: UploadPreviewPanelProps) {
  return (
    <div className="space-y-4 mb-4">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-500 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 opacity-80" />
          <div>
            <h2 className="text-lg font-bold">
              Forhåndsvisning — {className || "Timeplan"}
              {mode === "weekly"
                ? `, uke ${weekNumber}`
                : " (fast timeplan)"}
            </h2>
            <p className="text-purple-100 text-xs mt-0.5 flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              Klikk på en time for å redigere
            </p>
          </div>
        </div>
      </div>

      <PreviewScheduleGrid
        schedule={schedule}
        onEditEntry={onEditEntry}
      />

      <div className="space-y-3">
        {mode === "weekly" && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoSaveAsMasterplan}
              onChange={(e) => onAlsoSaveAsMasterplanChange(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            Lagre også som fast timeplan
          </label>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {isSaving ? "Lagrer..." : "Lagre timeplan"}
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium"
          >
            <X className="h-5 w-5" />
            Forkast
          </button>
        </div>
      </div>
    </div>
  );
}
