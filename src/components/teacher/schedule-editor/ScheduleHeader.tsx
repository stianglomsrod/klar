"use client";

import { Plus, Copy, Loader2 } from "lucide-react";
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
import type { MergedEntry } from "./types";

type ScheduleHeaderProps = {
  studentId?: string;
  selectedWeekNumber: number;
  onWeekNumberChange: (week: number) => void;
  hideWeekSelector?: boolean;
  scheduleEntries: MergedEntry[];
  onAddEntry: () => void;
  onMakeMasterplan: () => void;
  isMakingMasterplan: boolean;
};

export default function ScheduleHeader({
  studentId,
  selectedWeekNumber,
  onWeekNumberChange,
  hideWeekSelector,
  scheduleEntries,
  onAddEntry,
  onMakeMasterplan,
  isMakingMasterplan,
}: ScheduleHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h2 className="text-xl font-semibold text-slate-900">
        {studentId ? "Personlig timeplan" : "Klassens timeplan"}
      </h2>
      <div className="flex items-center gap-3">
        {!hideWeekSelector && (
          <div className="flex items-center gap-2 bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-sm font-semibold">Uke</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onWeekNumberChange(selectedWeekNumber - 1)}
                className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50"
                aria-label="Forrige uke"
              >
                –
              </button>
              <span className="min-w-[36px] text-center font-semibold">
                {selectedWeekNumber}
              </span>
              <button
                onClick={() => onWeekNumberChange(selectedWeekNumber + 1)}
                className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50"
                aria-label="Neste uke"
              >
                +
              </button>
            </div>
          </div>
        )}
        {/* Make masterplan — only shown when viewing a specific week with entries */}
        {selectedWeekNumber > 0 && scheduleEntries.length > 0 && !studentId && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm">
                <Copy size={16} />
                Sett som fast timeplan
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Sett uke {selectedWeekNumber} som fast timeplan?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Dette vil overskrive klassens nåværende faste timeplan med
                  innholdet fra uke {selectedWeekNumber}. Alle fremtidige uker
                  uten egne endringer vil bruke denne som utgangspunkt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onMakeMasterplan}
                  disabled={isMakingMasterplan}
                >
                  {isMakingMasterplan ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-1" />
                      Kopierer...
                    </>
                  ) : (
                    "Ja, sett som fast"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <button
          onClick={onAddEntry}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          Legg til time
        </button>
      </div>
    </div>
  );
}
