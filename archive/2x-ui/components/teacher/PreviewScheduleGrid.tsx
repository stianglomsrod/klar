"use client";

import { Pencil } from "lucide-react";
import type { ScheduleEntry } from "@/app/actions/parse-weekly-plan";

// ── Constants ────────────────────────────────────────

const DAYS: { number: number; name: string }[] = [
  { number: 1, name: "Mandag" },
  { number: 2, name: "Tirsdag" },
  { number: 3, name: "Onsdag" },
  { number: 4, name: "Torsdag" },
  { number: 5, name: "Fredag" },
];

// ── Props ────────────────────────────────────────────

type PreviewScheduleGridProps = {
  schedule: ScheduleEntry[];
  onEditEntry?: (entryIndex: number) => void;
};

// ── Helpers ──────────────────────────────────────────

function groupByClass(
  schedule: ScheduleEntry[],
): Record<string, ScheduleEntry[]> {
  return schedule.reduce<Record<string, ScheduleEntry[]>>((acc, entry) => {
    const key = entry.className || "Alle";
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
}

function groupByDay(entries: ScheduleEntry[]): Record<number, ScheduleEntry[]> {
  return entries.reduce<Record<number, ScheduleEntry[]>>((acc, entry) => {
    if (!acc[entry.dayOfWeek]) acc[entry.dayOfWeek] = [];
    acc[entry.dayOfWeek].push(entry);
    return acc;
  }, {});
}

function sortByTime(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ── Component ────────────────────────────────────────

export default function PreviewScheduleGrid({
  schedule,
  onEditEntry,
}: PreviewScheduleGridProps) {
  if (!schedule || schedule.length === 0) return null;

  const indexMap = new Map<ScheduleEntry, number>();
  schedule.forEach((e, i) => indexMap.set(e, i));

  const grouped = groupByClass(schedule);
  const classNames = Object.keys(grouped);

  return (
    <section className="space-y-6">
      {classNames.map((className) => {
        const entries = grouped[className];
        const byDay = groupByDay(entries);

        return (
          <div
            key={className}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-purple-50">
              <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                {className}
              </span>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Day headers */}
                <div className="grid grid-cols-5 border-b border-slate-200">
                  {DAYS.map((day) => (
                    <div
                      key={day.number}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-r border-slate-100 last:border-r-0"
                    >
                      {day.name}
                    </div>
                  ))}
                </div>

                {/* Timetable cells */}
                <div className="grid grid-cols-5">
                  {DAYS.map((day) => {
                    const dayEntries = sortByTime(byDay[day.number] || []);

                    return (
                      <div
                        key={day.number}
                        className="border-r border-slate-100 last:border-r-0 min-h-[120px]"
                      >
                        {dayEntries.length === 0 ? (
                          <div className="px-2 py-4 text-center">
                            <span className="text-xs text-slate-300">—</span>
                          </div>
                        ) : (
                          <div className="p-1.5 space-y-1.5">
                            {dayEntries.map((entry, idx) => (
                              <div
                                key={idx}
                                className="group rounded-lg bg-purple-50 border border-purple-100 p-2 hover:bg-purple-100 cursor-pointer transition-colors"
                                onClick={() =>
                                  onEditEntry?.(indexMap.get(entry)!)
                                }
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-xs font-semibold text-purple-800 leading-tight">
                                    {entry.subjectName}
                                  </p>
                                  <Pencil className="h-3 w-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                                </div>
                                <p className="text-[10px] text-purple-500 font-mono mt-0.5">
                                  {entry.startTime} – {entry.endTime}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
