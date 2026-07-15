"use client";

import { EditDialog } from "@/components/ui/edit-dialog";
import type { ScheduleEntry } from "@/app/actions/parse-weekly-plan";
import { WEEKDAY_OPTIONS } from "@/utils/constants";

// ── Types ────────────────────────────────────────────

type ScheduleEntryEditDialogProps = {
  /** Current edit state — null means the dialog is closed */
  editState: { index: number; entry: ScheduleEntry } | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (entry: ScheduleEntry) => void;
  /** Whether to show the className field (ukebrev flow) */
  showClassName?: boolean;
};

// ── Component ────────────────────────────────────────

export default function ScheduleEntryEditDialog({
  editState,
  onClose,
  onSave,
  onChange,
  showClassName = false,
}: ScheduleEntryEditDialogProps) {
  if (!editState) return null;

  const { entry } = editState;

  const update = (patch: Partial<ScheduleEntry>) => {
    onChange({ ...entry, ...patch });
  };

  return (
    <EditDialog
      open={editState !== null}
      onClose={onClose}
      title="Rediger timeplanoppføring"
      onSave={onSave}
    >
      <div className="space-y-3">
        {/* Subject name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fag
          </label>
          <input
            type="text"
            value={entry.subjectName}
            onChange={(e) => update({ subjectName: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
          />
        </div>

        {/* Class name (ukebrev only) */}
        {showClassName && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Klasse
            </label>
            <input
              type="text"
              value={entry.className}
              onChange={(e) => update({ className: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
            />
          </div>
        )}

        {/* Day of week */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Dag
          </label>
          <select
            value={entry.dayOfWeek}
            onChange={(e) => update({ dayOfWeek: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors bg-white"
          >
            {WEEKDAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Starttid
            </label>
            <input
              type="text"
              value={entry.startTime}
              onChange={(e) => update({ startTime: e.target.value })}
              placeholder="08:00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sluttid
            </label>
            <input
              type="text"
              value={entry.endTime}
              onChange={(e) => update({ endTime: e.target.value })}
              placeholder="09:00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
            />
          </div>
        </div>
      </div>
    </EditDialog>
  );
}
