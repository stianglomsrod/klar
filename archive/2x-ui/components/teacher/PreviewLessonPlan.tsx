"use client";

import { useState, useCallback } from "react";
import { Pencil, BookOpen, Users, Target, Check, X } from "lucide-react";
import type { LessonPlanTask } from "@/app/actions/parse-weekly-plan";

// ── Props ────────────────────────────────────────────

type PreviewLessonPlanProps = {
  tasks: LessonPlanTask[];
  onUpdateTask: (index: number, updated: LessonPlanTask) => void;
};

// ── Component ────────────────────────────────────────

export default function PreviewLessonPlan({
  tasks,
  onUpdateTask,
}: PreviewLessonPlanProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
  }>({ title: "", description: "" });

  const startEditing = useCallback(
    (index: number) => {
      setEditForm({
        title: tasks[index].title,
        description: tasks[index].description,
      });
      setEditingIndex(index);
    },
    [tasks],
  );

  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;
    onUpdateTask(editingIndex, {
      ...tasks[editingIndex],
      title: editForm.title,
      description: editForm.description,
    });
    setEditingIndex(null);
  }, [editingIndex, editForm, tasks, onUpdateTask]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Ingen oppgaver funnet i dokumentet.</p>
      </div>
    );
  }

  // Group tasks by subject
  const grouped = new Map<string, { task: LessonPlanTask; index: number }[]>();
  tasks.forEach((task, index) => {
    const key = task.subjectName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ task, index });
  });

  // Sort within each group by sessionNumber
  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.task.sessionNumber - b.task.sessionNumber);
  }

  return (
    <section className="space-y-6">
      {[...grouped.entries()].map(([subjectName, entries]) => (
        <div
          key={subjectName}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          {/* Subject Header */}
          <div className="px-5 py-4 border-b border-slate-100 bg-indigo-50 flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">{subjectName}</h3>
            <span className="ml-auto text-xs text-indigo-500 font-medium">
              {entries.length} {entries.length === 1 ? "økt" : "økter"}
            </span>
          </div>

          {/* Task Cards */}
          <div className="divide-y divide-slate-100">
            {entries.map(({ task, index }) => (
              <div key={index} className="px-5 py-4">
                {editingIndex === index ? (
                  /* ── Inline Edit Mode ── */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Tittel
                      </label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Beskrivelse
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Lagre
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                      >
                        <X className="h-3.5 w-3.5" />
                        Avbryt
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Display Mode ── */
                  <div className="group">
                    {/* Top row: session badge + title + edit button */}
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold flex-shrink-0 mt-0.5">
                        Økt {task.sessionNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 leading-tight">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => startEditing(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        title="Rediger"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Goals */}
                    {task.goals.length > 0 && (
                      <div className="mt-3 ml-[calc(2.5rem+0.75rem)]">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Target className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-700">
                            Læringsmål
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {task.goals.map((goal, gi) => (
                            <li
                              key={gi}
                              className="text-xs text-slate-600 flex items-start gap-1.5"
                            >
                              <span className="text-emerald-400 mt-0.5 flex-shrink-0">
                                •
                              </span>
                              {goal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Target classes */}
                    {task.targetClasses.length > 0 && (
                      <div className="mt-3 ml-[calc(2.5rem+0.75rem)] flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <div className="flex gap-1.5 flex-wrap">
                          {task.targetClasses.map((cls) => (
                            <span
                              key={cls}
                              className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium"
                            >
                              {cls}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
