"use client";

import {
  Edit2,
  Trash2,
  Clock,
  RotateCcw,
  User,
  Eraser,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { MergedEntry, ScheduleEntry } from "./types";
import { getDefaultTitle, getSubjectMeta } from "./schedule-helpers";
import type { Subject } from "./types";

type ScheduleEntryCardProps = {
  entry: MergedEntry;
  subjects: Subject[];
  highlightOverrides?: boolean;
  selectedWeekNumber: number;
  onEdit: (entry: ScheduleEntry) => void;
  onClear: (entry: MergedEntry) => void;
  onReset: (entry: MergedEntry) => void;
  onDelete: (entry: MergedEntry) => void;
};

export default function ScheduleEntryCard({
  entry,
  subjects,
  highlightOverrides,
  selectedWeekNumber,
  onEdit,
  onClear,
  onReset,
  onDelete,
}: ScheduleEntryCardProps) {
  const isPersonal = !!entry.student_id;
  const isWeekOverride =
    highlightOverrides && selectedWeekNumber > 0 && !entry.isFallback;

  const subjectMeta = getSubjectMeta(entry.subject_id, subjects);
  const borderColor = subjectMeta ? subjectMeta.theme.border : "border-slate-300";

  // Prefix: always computed from time slot
  const prefix = getDefaultTitle(entry) || "Uten tittel";
  // Suffix: subject name OR actual custom title (not matching default label)
  const defaultLabel = getDefaultTitle(entry);
  const actualCustom =
    entry.custom_title && entry.custom_title !== defaultLabel
      ? entry.custom_title
      : null;
  const suffix = subjectMeta?.name || actualCustom || null;
  const topLine = suffix ? `${prefix} · ${suffix}` : prefix;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(entry)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(entry);
        }
      }}
      className={`p-2 rounded text-xs group relative border shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all duration-150 hover:-translate-y-[2px] hover:shadow-md ${
        isPersonal
          ? "bg-indigo-50/70 border-indigo-100"
          : "bg-white border-slate-200 hover:bg-slate-50/80"
      } ${isWeekOverride ? "border-amber-400 bg-amber-50/60" : ""}`}
    >
      <div
        className={`flex items-start justify-between gap-1 border-l-4 ${borderColor} pl-3 transition-colors duration-150 group-hover:border-l-[6px] group-hover:pl-[11px]`}
      >
        {isPersonal && (
          <div className="absolute top-1 right-1 text-indigo-500/80" aria-hidden>
            <User size={14} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            {isPersonal && (
              <span className="inline-block px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-medium">
                Personlig
              </span>
            )}
            {isWeekOverride && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                Endret
              </span>
            )}
          </div>
          <p className="font-semibold text-slate-900 truncate leading-tight">
            {topLine}
          </p>
          <p className="text-slate-600 flex items-center gap-1">
            <Clock size={12} />
            {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
          </p>
        </div>
        <div
          className="hidden group-hover:flex gap-1 flex-shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isWeekOverride && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset(entry);
              }}
              className="p-1 text-amber-800 hover:bg-amber-100 rounded transition-colors flex items-center gap-1"
              title="Tilbakestill til master"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(entry)}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
            title="Rediger"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onClear(entry)}
            className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors"
            title="Tøm innhold"
          >
            <Eraser size={14} />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-1 text-slate-600 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                title="Slett time"
              >
                <Trash2 size={14} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slett time?</AlertDialogTitle>
                <AlertDialogDescription>
                  Er du sikker på at du vil fjerne denne timen fra timeplanen?
                  Dette kan ikke angres.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => onDelete(entry)}
                >
                  Slett
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
