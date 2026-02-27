"use client";

import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import type { QuizQuestion } from "@/types/shared";
import type { ToastVariant } from "@/hooks/useToast";

interface QuizBuilderProps {
  questions: QuizQuestion[];
  onQuestionsChange: (questions: QuizQuestion[]) => void;
  showToast: (message: string, variant: ToastVariant) => void;
}

export default function QuizBuilder({
  questions,
  onQuestionsChange,
  showToast,
}: QuizBuilderProps) {
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<
    "text" | "radio" | "checkbox"
  >("text");

  const addQuizQuestion = () => {
    if (!newQuestionText.trim()) {
      showToast("Vennligst skriv inn et spørsmål", "warning");
      return;
    }

    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      text: newQuestionText,
      answerType: newQuestionType,
      options: [],
    };

    onQuestionsChange([...questions, newQuestion]);
    setNewQuestionText("");
    setNewQuestionType("text");
  };

  const deleteQuizQuestion = (questionId: string) => {
    onQuestionsChange(questions.filter((q) => q.id !== questionId));
  };

  const addOptionToQuestion = (questionId: string, option: string) => {
    if (!option.trim()) return;

    onQuestionsChange(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, option] } : q,
      ),
    );
  };

  const removeOptionFromQuestion = (
    questionId: string,
    optionIndex: number,
  ) => {
    onQuestionsChange(
      questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((_, i) => i !== optionIndex) }
          : q,
      ),
    );
  };

  return (
    <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Spørsmål ({questions.length})
        </h3>
        <button
          type="button"
          onClick={addQuizQuestion}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-300 rounded-lg transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Legg til spørsmål
        </button>
      </div>

      {/* New Question Builder */}
      <div className="space-y-3 mb-4 p-3 bg-white rounded-lg border border-indigo-200">
        <input
          type="text"
          value={newQuestionText}
          onChange={(e) => setNewQuestionText(e.target.value)}
          placeholder="Skriv spørsmålet her..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Svartype
          </label>
          <select
            value={newQuestionType}
            onChange={(e) =>
              setNewQuestionType(
                e.target.value as "text" | "radio" | "checkbox",
              )
            }
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="text">Tekstsvar</option>
            <option value="radio">Flervalg (én riktig)</option>
            <option value="checkbox">Flervalg (flere riktige)</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="p-3 bg-white rounded-lg border border-slate-200"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <span className="text-xs font-semibold text-indigo-600">
                    Spørsmål {index + 1}
                  </span>
                  <p className="text-sm text-slate-900 mt-1">{question.text}</p>
                  <span className="text-xs text-slate-500">
                    {question.answerType === "text" && "Tekstsvar"}
                    {question.answerType === "radio" && "Flervalg (én riktig)"}
                    {question.answerType === "checkbox" &&
                      "Flervalg (flere riktige)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteQuizQuestion(question.id)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Options for radio/checkbox */}
              {(question.answerType === "radio" ||
                question.answerType === "checkbox") && (
                <div className="mt-2 space-y-1">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded flex-1">
                        {option}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          removeOptionFromQuestion(question.id, optionIndex)
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    placeholder="Legg til alternativ (trykk Enter)"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const input = e.currentTarget;
                        addOptionToQuestion(question.id, input.value);
                        input.value = "";
                      }
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
