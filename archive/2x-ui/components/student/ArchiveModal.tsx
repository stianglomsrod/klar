"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Archive, X, Undo2 } from "lucide-react";
import type { StudentTask } from "@/types/shared";

// ── Pulse hook (detects when completedCount increases) ──

export function useArchivePulse(completedCount: number) {
  const [isStackPulsing, setIsStackPulsing] = useState(false);
  const prevCount = useRef(completedCount);

  useEffect(() => {
    if (completedCount > prevCount.current) {
      // Defer setState to avoid synchronous setState-in-effect (React 19)
      const startTimer = setTimeout(() => setIsStackPulsing(true), 0);
      const endTimer = setTimeout(() => setIsStackPulsing(false), 300);
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
    prevCount.current = completedCount;
  }, [completedCount]);

  return isStackPulsing;
}

// ── Archive Button (renders inside SubjectHero as absolute-positioned child) ──

type ArchiveButtonProps = {
  completedCount: number;
  isStackPulsing: boolean;
  onOpen: () => void;
};

export function ArchiveButton({
  completedCount,
  isStackPulsing,
  onOpen,
}: ArchiveButtonProps) {
  if (completedCount === 0) return null;

  return (
    <motion.button
      onClick={onOpen}
      className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer border-2 border-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
      title="Se fullførte oppgaver"
      animate={isStackPulsing ? { scale: [1, 1.25, 1] } : { scale: 1 }}
      transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
    >
      <Archive className="h-5 w-5 text-gray-600" />
      <span className="font-bold text-sm text-gray-700">Ferdig</span>

      {/* Counter Badge */}
      <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
        {completedCount}
      </span>
    </motion.button>
  );
}

// ── Archive Modal ──

type ArchiveModalProps = {
  isOpen: boolean;
  onClose: () => void;
  completedTasks: StudentTask[];
  onUndo: (taskId: string) => void;
};

export default function ArchiveModal({
  isOpen,
  onClose,
  completedTasks,
  onUndo,
}: ArchiveModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Archive className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Fullførte oppdrag
            </h2>
            <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-1 rounded-full">
              {completedTasks.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {completedTasks.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen fullførte oppgaver ennå.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {task.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {task.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                          ✓ Fullført
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {task.points_value} poeng
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onUndo(task.id)}
                      className="flex-shrink-0 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-amber-200"
                    >
                      <Undo2 className="h-4 w-4" />
                      Angre
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
