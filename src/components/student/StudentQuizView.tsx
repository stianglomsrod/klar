"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, X, Send } from "lucide-react";
import CompletionModal from "@/components/CompletionModal";
import TTSButton from "@/components/ui/TTSButton";
import AudioRecorder from "@/components/ui/AudioRecorder";

export type QuizQuestion = {
  id: string;
  text: string;
  answerType: "text" | "radio" | "checkbox";
  options: string[];
};

export type QuizResponses = Record<string, string | string[]>;

/** Per-question audio blobs keyed by question ID */
export type QuizAudioBlobs = Record<string, Blob>;

type StudentQuizViewProps = {
  isOpen: boolean;
  questions: QuizQuestion[];
  taskTitle: string;
  onClose: () => void;
  onSubmit: (responses: QuizResponses, audioBlobs: QuizAudioBlobs) => void;
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export default function StudentQuizView({
  isOpen,
  questions,
  taskTitle,
  onClose,
  onSubmit,
}: StudentQuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<QuizResponses>({});
  const [audioBlobs, setAudioBlobs] = useState<QuizAudioBlobs>({});
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      // Use a microtask to avoid synchronous setState in effect body
      queueMicrotask(() => {
        setCurrentIndex(0);
        setResponses({});
        // Revoke old audio object URLs
        Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
        setAudioBlobs({});
        setAudioUrls({});
        setDirection(0);
        setShowConfirmation(false);
      });
    }
  }, [isOpen]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const isAnswered = (questionId: string) => {
    // Audio recording counts as a completed answer
    if (audioBlobs[questionId]) return true;
    const r = responses[questionId];
    if (!r) return false;
    if (Array.isArray(r)) return r.length > 0;
    return r.trim().length > 0;
  };

  const answeredCount = questions.filter((q) => isAnswered(q.id)).length;
  const unansweredCount = totalQuestions - answeredCount;

  const handleTextChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleRadioSelect = (questionId: string, option: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleCheckboxToggle = (questionId: string, option: string) => {
    setResponses((prev) => {
      const current = (prev[questionId] as string[]) || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: updated };
    });
  };

  const goNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const goToQuestion = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const handleSubmitAttempt = () => {
    // Always show confirmation modal directly — it includes a warning if unanswered
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmation(false);
    onSubmit(responses, audioBlobs);
  };

  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-screen backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 z-50"
          />

          {/* Quiz container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              <h1 className="text-white font-bold text-lg truncate max-w-[60%]">
                {taskTitle}
              </h1>
              <div className="text-white/70 text-sm font-medium">
                {answeredCount}/{totalQuestions}
              </div>
            </div>

            {/* Progress bubbles */}
            <div className="flex items-center justify-center gap-2 px-4 py-3 flex-wrap">
              {questions.map((q, i) => {
                const answered = isAnswered(q.id);
                const active = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(i)}
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                      transition-all duration-200 border-2
                      ${
                        active
                          ? "bg-white text-purple-700 border-white scale-110 shadow-lg shadow-white/30"
                          : answered
                            ? "bg-emerald-400 text-white border-emerald-300 shadow-md shadow-emerald-400/30"
                            : "bg-white/20 text-white/80 border-white/30 hover:bg-white/30"
                      }
                    `}
                  >
                    {answered && !active ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </button>
                );
              })}
            </div>

            {/* Question area */}
            <div className="flex-1 flex flex-col px-4 pb-4 min-h-0 overflow-hidden">
              <div className="flex-1 flex items-center justify-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentQuestion.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="w-full max-w-lg"
                  >
                    {/* Question card */}
                    <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8">
                      {/* Question number & type */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
                          Spørsmål {currentIndex + 1}
                        </span>
                        <span className="text-gray-400 text-xs font-medium">
                          {currentQuestion.answerType === "text"
                            ? "Skriv svar"
                            : currentQuestion.answerType === "radio"
                              ? "Velg ett"
                              : "Velg flere"}
                        </span>
                      </div>

                      {/* Question text */}
                      <div className="flex items-start gap-2 mb-6">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug flex-1">
                          {currentQuestion.text}
                        </h2>
                        <TTSButton
                          text={
                            currentQuestion.options.length > 0
                              ? `${currentQuestion.text}. Alternativer: ${currentQuestion.options.join(", ")}`
                              : currentQuestion.text
                          }
                        />
                      </div>

                      {/* Answer area */}
                      <div className="space-y-3">
                        {currentQuestion.answerType === "text" && (
                          <textarea
                            value={
                              (responses[currentQuestion.id] as string) || ""
                            }
                            onChange={(e) =>
                              handleTextChange(
                                currentQuestion.id,
                                e.target.value,
                              )
                            }
                            placeholder="Skriv svaret ditt her..."
                            className="w-full min-h-[120px] p-4 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none text-gray-900 text-base resize-none transition-all"
                          />
                        )}

                        {currentQuestion.answerType === "radio" &&
                          currentQuestion.options.map((option, optIdx) => {
                            const selected =
                              responses[currentQuestion.id] === option;
                            return (
                              <motion.button
                                key={optIdx}
                                whileTap={{ scale: 0.97 }}
                                onClick={() =>
                                  handleRadioSelect(currentQuestion.id, option)
                                }
                                className={`
                                  w-full text-left p-4 rounded-2xl border-2 font-semibold text-base transition-all duration-200
                                  ${
                                    selected
                                      ? "bg-purple-50 border-purple-400 text-purple-900 shadow-md shadow-purple-100"
                                      : "bg-gray-50 border-gray-200 text-gray-800 hover:border-gray-300 hover:bg-gray-100"
                                  }
                                `}
                              >
                                <span className="flex items-center gap-3">
                                  <span
                                    className={`
                                    w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                    ${selected ? "bg-purple-500 border-purple-500" : "border-gray-300"}
                                  `}
                                  >
                                    {selected && (
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    )}
                                  </span>
                                  {option}
                                </span>
                              </motion.button>
                            );
                          })}

                        {currentQuestion.answerType === "checkbox" &&
                          currentQuestion.options.map((option, optIdx) => {
                            const currentSelections =
                              (responses[currentQuestion.id] as string[]) || [];
                            const selected = currentSelections.includes(option);
                            return (
                              <motion.button
                                key={optIdx}
                                whileTap={{ scale: 0.97 }}
                                onClick={() =>
                                  handleCheckboxToggle(
                                    currentQuestion.id,
                                    option,
                                  )
                                }
                                className={`
                                  w-full text-left p-4 rounded-2xl border-2 font-semibold text-base transition-all duration-200
                                  ${
                                    selected
                                      ? "bg-purple-50 border-purple-400 text-purple-900 shadow-md shadow-purple-100"
                                      : "bg-gray-50 border-gray-200 text-gray-800 hover:border-gray-300 hover:bg-gray-100"
                                  }
                                `}
                              >
                                <span className="flex items-center gap-3">
                                  <span
                                    className={`
                                    w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0
                                    ${selected ? "bg-purple-500 border-purple-500" : "border-gray-300"}
                                  `}
                                  >
                                    {selected && (
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    )}
                                  </span>
                                  {option}
                                </span>
                              </motion.button>
                            );
                          })}
                      </div>

                      {/* Per-question audio recorder */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <AudioRecorder
                          compact
                          onRecorded={(blob) => {
                            const url = URL.createObjectURL(blob);
                            setAudioBlobs((prev) => ({
                              ...prev,
                              [currentQuestion.id]: blob,
                            }));
                            setAudioUrls((prev) => ({
                              ...prev,
                              [currentQuestion.id]: url,
                            }));
                          }}
                          onRemove={() => {
                            const url = audioUrls[currentQuestion.id];
                            if (url) URL.revokeObjectURL(url);
                            setAudioBlobs((prev) => {
                              const next = { ...prev };
                              delete next[currentQuestion.id];
                              return next;
                            });
                            setAudioUrls((prev) => {
                              const next = { ...prev };
                              delete next[currentQuestion.id];
                              return next;
                            });
                          }}
                          hasRecording={!!audioBlobs[currentQuestion.id]}
                          audioUrl={audioUrls[currentQuestion.id]}
                        />
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation footer */}
              <div className="flex items-center justify-between gap-3 pt-4 max-w-lg mx-auto w-full">
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className={`
                    flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all
                    ${
                      currentIndex === 0
                        ? "opacity-0 pointer-events-none"
                        : "bg-white/20 hover:bg-white/30 text-white"
                    }
                  `}
                >
                  <ChevronLeft className="h-5 w-5" />
                  Forrige
                </button>

                {isLastQuestion ? (
                  <button
                    onClick={handleSubmitAttempt}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black px-8 py-4 rounded-2xl shadow-md transition-all active:scale-[0.97] hover:scale-[1.02] text-lg uppercase tracking-wide"
                  >
                    <Send className="h-5 w-5" />
                    Lever
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-xl font-semibold transition-all"
                  >
                    Neste
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Confirmation modal — overlays the quiz view */}
            <div className="relative z-[60]">
              <CompletionModal
                isOpen={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={handleConfirmSubmit}
                warningMessage={
                  unansweredCount > 0
                    ? `Du har ${unansweredCount} ubesvart${unansweredCount > 1 ? "e" : ""} spørsmål.`
                    : undefined
                }
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
