"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  CircleDot,
  CheckSquare,
  Type,
} from "lucide-react";
import type { QuizQuestion } from "@/types/shared";
import type { ToastVariant } from "@/hooks/useToast";

interface QuizBuilderProps {
  questions: QuizQuestion[];
  onQuestionsChange: (questions: QuizQuestion[]) => void;
  showToast: (message: string, variant: ToastVariant) => void;
}

const ANSWER_TYPES: {
  value: QuizQuestion["answerType"];
  label: string;
  icon: typeof Type;
}[] = [
  { value: "text", label: "Tekstsvar", icon: Type },
  { value: "radio", label: "Flervalg (én riktig)", icon: CircleDot },
  { value: "checkbox", label: "Flervalg (flere riktige)", icon: CheckSquare },
];

export default function QuizBuilder({
  questions,
  onQuestionsChange,
  showToast,
}: QuizBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Question CRUD ──────────────────────────────────────

  const addQuestion = () => {
    const id = Date.now().toString();
    const newQ: QuizQuestion = {
      id,
      text: "",
      answerType: "radio",
      options: ["", ""],
    };
    onQuestionsChange([...questions, newQ]);
    setExpandedId(id);
  };

  const updateQuestion = (id: string, patch: Partial<QuizQuestion>) => {
    onQuestionsChange(
      questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const deleteQuestion = (id: string) => {
    onQuestionsChange(questions.filter((q) => q.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  // ── Option helpers ─────────────────────────────────────

  const addOption = (qId: string) => {
    const q = questions.find((q) => q.id === qId);
    if (!q) return;
    updateQuestion(qId, { options: [...q.options, ""] });
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    const q = questions.find((q) => q.id === qId);
    if (!q) return;
    const opts = [...q.options];
    opts[idx] = value;
    updateQuestion(qId, { options: opts });
  };

  const removeOption = (qId: string, idx: number) => {
    const q = questions.find((q) => q.id === qId);
    if (!q) return;
    if (q.options.length <= 2) {
      showToast("Flervalg trenger minst to alternativer", "warning");
      return;
    }
    updateQuestion(qId, { options: q.options.filter((_, i) => i !== idx) });
  };

  const changeAnswerType = (qId: string, type: QuizQuestion["answerType"]) => {
    const q = questions.find((q) => q.id === qId);
    if (!q) return;
    // When switching to text, clear options; when switching to choice, seed 2 blanks
    if (type === "text") {
      updateQuestion(qId, { answerType: type, options: [] });
    } else if (q.answerType === "text") {
      updateQuestion(qId, { answerType: type, options: ["", ""] });
    } else {
      updateQuestion(qId, { answerType: type });
    }
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Question Cards */}
      {questions.map((q, index) => {
        const isExpanded = expandedId === q.id;
        const typeInfo = ANSWER_TYPES.find((t) => t.value === q.answerType)!;
        const TypeIcon = typeInfo.icon;

        return (
          <div
            key={q.id}
            className={`bg-white rounded-xl border transition-shadow ${
              isExpanded
                ? "border-indigo-300 shadow-md ring-1 ring-indigo-200"
                : "border-slate-200 shadow-sm hover:shadow"
            }`}
          >
            {/* Card Header — always visible */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : q.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="text-xs font-bold text-indigo-600 shrink-0 w-5">
                {index + 1}
              </span>
              <span className="flex-1 text-sm text-slate-800 truncate">
                {q.text || (
                  <span className="text-slate-400 italic">Nytt spørsmål…</span>
                )}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                <TypeIcon className="h-3 w-3" />
                {typeInfo.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteQuestion(q.id);
                }}
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                aria-label="Slett spørsmål"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </button>

            {/* Card Body — expanded */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-100">
                {/* Question text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Spørsmål
                  </label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) =>
                      updateQuestion(q.id, { text: e.target.value })
                    }
                    placeholder="Skriv spørsmålet her…"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Answer type selector — pill buttons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Svartype
                  </label>
                  <div className="flex gap-1.5">
                    {ANSWER_TYPES.map((t) => {
                      const Icon = t.icon;
                      const active = q.answerType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => changeAnswerType(q.id, t.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            active
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Options editor (radio / checkbox) */}
                {(q.answerType === "radio" || q.answerType === "checkbox") && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Alternativer
                    </label>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          {/* Visual indicator */}
                          {q.answerType === "radio" ? (
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                          )}
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              updateOption(q.id, optIdx, e.target.value)
                            }
                            placeholder={`Alternativ ${optIdx + 1}`}
                            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(q.id, optIdx)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                            aria-label="Fjern alternativ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Explicit add-option button */}
                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 py-1 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Legg til alternativ
                      </button>
                    </div>
                  </div>
                )}

                {/* Text-answer hint */}
                {q.answerType === "text" && (
                  <p className="text-xs text-slate-400 italic">
                    Eleven skriver svaret sitt i et fritekstfelt.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Question button */}
      <button
        type="button"
        onClick={addQuestion}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-300 rounded-xl transition-colors"
      >
        <Plus className="h-4 w-4" />
        Legg til spørsmål
      </button>
    </div>
  );
}
