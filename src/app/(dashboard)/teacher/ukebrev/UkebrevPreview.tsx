"use client";

import {
  Megaphone,
  GraduationCap,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import type { WeeklyPlanData } from "@/app/actions/parse-weekly-plan";
import type { EditState } from "./useUkebrevMutators";
import PreviewScheduleGrid from "@/components/teacher/PreviewScheduleGrid";

// ── Props ──

type UkebrevPreviewProps = {
  data: WeeklyPlanData;
  onEdit: (state: EditState) => void;
};

// ── Component ──

export default function UkebrevPreview({ data, onEdit }: UkebrevPreviewProps) {
  return (
    <>
      {/* General Messages */}
      {data.generalMessages.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-amber-50 flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800">
              Beskjeder og informasjon
            </h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.generalMessages.map((msg, i) => (
              <li
                key={i}
                className="px-5 py-3 text-slate-700 text-sm hover:bg-amber-50 cursor-pointer transition-colors"
                onClick={() =>
                  onEdit({ type: "message", index: i, value: msg })
                }
              >
                {msg}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Learning Goals */}
      {data.learningGoals.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50 flex items-center gap-2.5">
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-800">Læringsmål</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.learningGoals.map((goal, i) => (
              <div key={i} className="px-5 py-4">
                <h4
                  className="font-medium text-slate-900 mb-2 hover:text-emerald-700 cursor-pointer transition-colors inline-block"
                  onClick={() =>
                    onEdit({
                      type: "goalSubject",
                      index: i,
                      value: goal.subject,
                    })
                  }
                >
                  {goal.subject}
                </h4>
                <ul className="space-y-1.5">
                  {goal.goals.map((g, j) => (
                    <li
                      key={j}
                      className="text-sm text-slate-600 flex items-start gap-2 hover:bg-emerald-50 cursor-pointer transition-colors rounded-md px-1.5 py-0.5 -mx-1.5"
                      onClick={() =>
                        onEdit({
                          type: "goalItem",
                          goalIndex: i,
                          itemIndex: j,
                          value: g,
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Homework */}
      {data.homework.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-blue-50 flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800">Lekser</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.homework.map((hw, i) => (
              <div key={i} className="px-5 py-4">
                <h4
                  className="font-medium text-slate-900 mb-2 hover:text-blue-700 cursor-pointer transition-colors inline-block"
                  onClick={() =>
                    onEdit({
                      type: "homeworkSubject",
                      index: i,
                      value: hw.subject,
                    })
                  }
                >
                  {hw.subject}
                </h4>
                <ul className="space-y-1.5">
                  {hw.tasks.map((task, j) => (
                    <li
                      key={j}
                      className="text-sm text-slate-600 flex items-start gap-2 hover:bg-blue-50 cursor-pointer transition-colors rounded-md px-1.5 py-0.5 -mx-1.5"
                      onClick={() =>
                        onEdit({
                          type: "homeworkTask",
                          hwIndex: i,
                          taskIndex: j,
                          value: task,
                        })
                      }
                    >
                      <span className="text-blue-400 mt-0.5">•</span>
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Schedule Grid */}
      {data.schedule.length > 0 && (
        <PreviewScheduleGrid
          schedule={data.schedule}
          onEditEntry={(idx) =>
            onEdit({
              type: "schedule",
              index: idx,
              entry: { ...data.schedule[idx] },
            })
          }
        />
      )}
    </>
  );
}
