"use client";

import { useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Zap, Trophy, ArrowRight, Sparkles } from "lucide-react";
import { useAvailableRewards } from "@/hooks/useAvailableRewards";
import type { StudentTask } from "@/types/shared";

// ── Types ────────────────────────────────────────────────────

type HalfwayModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentXp: number;
  goalTotal: number;
  level: number;
  studentId: string;
  showFlowerGarden: boolean;
  incompleteTasks: StudentTask[];
  subjectContext?: { id: string; title: string };
};

// ── Component ────────────────────────────────────────

export default function HalfwayModal({
  isOpen,
  onClose,
  currentXp,
  goalTotal,
  level,
  studentId,
  showFlowerGarden,
  incompleteTasks,
  subjectContext,
}: HalfwayModalProps) {
  const { rewards, loading: loadingRewards } = useAvailableRewards(
    studentId,
    isOpen,
  );

  // ── Confetti burst on open ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.35 },
        colors: ["#FFD700", "#FF6B6B", "#4ECDC4", "#9B59B6", "#FF69B4"],
        gravity: 0.8,
        scalar: 0.9,
        ticks: 120,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // ── Fastest path calculation ───────────────────────
  const remainingXp = useMemo(
    () => goalTotal - currentXp,
    [goalTotal, currentXp],
  );

  const fastestPath = useMemo(() => {
    const available = incompleteTasks
      .filter((t) => !t.is_completed)
      .sort((a, b) => b.points_value - a.points_value);

    const picked: StudentTask[] = [];
    let accumulated = 0;

    for (const task of available) {
      if (accumulated >= remainingXp) break;
      picked.push(task);
      accumulated += task.points_value;
    }

    return picked;
  }, [incompleteTasks, remainingXp]);

  const fastestPathTotalXp = useMemo(
    () => fastestPath.reduce((sum, t) => sum + t.points_value, 0),
    [fastestPath],
  );

  const canReachLevel = fastestPathTotalXp >= remainingXp;

  // ── Progress percentage ────────────────────────────
  const progressPercent = useMemo(
    () => Math.min(100, Math.round((currentXp / goalTotal) * 100)),
    [currentXp, goalTotal],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Celebration Header */}
            <div className="bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 px-4 sm:px-6 py-6 sm:py-8 text-center relative overflow-hidden">
              {/* Decorative sparkles */}
              <motion.div
                className="absolute top-3 left-6 text-2xl"
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✨
              </motion.div>
              <motion.div
                className="absolute top-4 right-8 text-xl"
                animate={{ rotate: [0, -20, 20, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              >
                ⭐
              </motion.div>

              <motion.div
                className="text-5xl mb-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  damping: 10,
                  stiffness: 200,
                  delay: 0.2,
                }}
              >
                🎯
              </motion.div>
              <h2 className="text-2xl font-extrabold text-white drop-shadow-sm">
                Halvveis!
              </h2>
              <p className="text-white/90 text-sm mt-1 font-medium">
                Du er halvveis til nivå {level + 1}!
              </p>
            </div>

            {/* Progress Bar */}
            <div className="px-4 sm:px-6 pt-5 pb-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Nivå {level}</span>
                <span className="text-amber-600">{progressPercent}%</span>
                <span>Nivå {level + 1}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                />
              </div>
              <p className="text-center text-xs text-slate-500 mt-2">
                {remainingXp} XP igjen til neste nivå
              </p>
            </div>

            {/* Reward Teaser */}
            {(rewards.length > 0 || showFlowerGarden) && (
              <div className="px-4 sm:px-6 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-700">
                    Belønninger på nivå {level + 1}:
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {showFlowerGarden && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 border border-pink-200 rounded-full">
                      <span className="text-base">🌸</span>
                      <span className="text-xs font-medium text-pink-700">
                        Fargelegg kronblad
                      </span>
                    </div>
                  )}
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full"
                    >
                      <span className="text-base">{reward.emoji || "🎁"}</span>
                      <span className="text-xs font-medium text-indigo-700 truncate max-w-[120px]">
                        {reward.title}
                      </span>
                    </div>
                  ))}
                  {loadingRewards && (
                    <div className="px-3 py-1.5 text-xs text-slate-400">
                      Laster...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fastest Path */}
            {fastestPath.length > 0 && (
              <div className="px-4 sm:px-6 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-slate-700">
                    {subjectContext
                      ? `Raskeste vei i ${subjectContext.title}:`
                      : "Foreslåtte oppgaver:"}
                  </h3>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {fastestPath.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"
                    >
                      <span className="text-sm text-slate-700 truncate flex-1 mr-2">
                        {task.title}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full whitespace-nowrap">
                        <Sparkles className="h-3 w-3" />
                        {task.points_value} XP
                      </span>
                    </div>
                  ))}
                </div>
                {canReachLevel ? (
                  <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {fastestPath.length === 1
                      ? "Fullfør denne oppgaven for å nå neste nivå!"
                      : `Fullfør disse ${fastestPath.length} oppgavene for å nå neste nivå!`}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-2">
                    Fortsett det gode arbeidet! 💪
                  </p>
                )}
              </div>
            )}

            {/* Fallback when no tasks */}
            {fastestPath.length === 0 && (
              <div className="px-4 sm:px-6 py-3 text-center">
                <p className="text-sm text-slate-500">
                  Fortsett det gode arbeidet! 💪
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 sm:px-6 py-5">
              <button
                onClick={handleClose}
                className="w-full px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                Fortsett! 💪
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
