"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Archive } from "lucide-react";
import Link from "next/link";
import { getSubjectTheme } from "@/utils/subject-colors";
import type { SubjectWithTasks } from "@/types/shared";

type Subject = SubjectWithTasks;

type ArchiveDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  completedSubjects: Subject[];
};

export default function ArchiveDrawer({
  isOpen,
  onClose,
  completedSubjects,
}: ArchiveDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Drawer - Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Archive className="h-5 w-5 text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Arkiv - Fullførte fag
                </h2>
                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                  {completedSubjects.length}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            {/* Content - Scrollable List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {completedSubjects.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Ingen fullførte fag ennå</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedSubjects.map((subject) => {
                    const theme = getSubjectTheme(
                      subject.color_theme || "gray",
                    );
                    const totalTasks = subject.tasks?.length || 0;
                    const completedTasks =
                      subject.tasks?.filter((t) => t.is_completed).length || 0;

                    return (
                      <Link
                        key={subject.id}
                        href={`/subject/${subject.id}`}
                        className="block group"
                      >
                        <motion.div
                          whileHover={{ x: 4 }}
                          className={`p-4 rounded-xl border-2 ${theme.border} ${theme.light} hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-2xl flex-shrink-0">
                              {subject.emoji}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {subject.title}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {completedTasks} av {totalTasks} oppgaver
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                            Ferdig ✓
                          </div>
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
