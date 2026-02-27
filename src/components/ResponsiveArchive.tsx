"use client";

import { motion } from "framer-motion";
import { X, Archive } from "lucide-react";
import Link from "next/link";
import { getSubjectTheme } from "@/utils/subject-colors";
import { useLayoutEffect, useState, startTransition } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import ArchiveDrawer from "./ArchiveDrawer";
import type { SubjectWithTasks } from "@/types/shared";

// Inline useMediaQuery hook
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(query);
    startTransition(() => {
      setMatches(mediaQuery.matches);
    });

    const handleChange = (e: MediaQueryListEvent) => {
      startTransition(() => {
        setMatches(e.matches);
      });
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

type Subject = SubjectWithTasks;

type ResponsiveArchiveProps = {
  completedSubjects: Subject[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  completedSubjectsCount: number;
};

export default function ResponsiveArchive({
  completedSubjects,
  isOpen,
  onOpenChange,
  completedSubjectsCount,
}: ResponsiveArchiveProps) {
  // Check if screen is large (desktop)
  const isLarge = useMediaQuery("(min-width: 1024px)");

  // On mobile, use Drawer; on desktop, use Popover
  if (!isLarge) {
    return (
      <>
        {/* Mobile: Floating Action Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenChange(true)}
          className="fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-slate-800 hover:bg-slate-900 text-white shadow-lg transition-colors"
          title="Åpne arkiv"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Archive className="h-6 w-6" />}
          {completedSubjectsCount > 0 && !isOpen && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {completedSubjectsCount}
            </span>
          )}
        </motion.button>

        {/* Mobile: Drawer */}
        <ArchiveDrawer
          isOpen={isOpen}
          onClose={() => onOpenChange(false)}
          completedSubjects={completedSubjects}
        />
      </>
    );
  }

  // Desktop: Popover with trigger button
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-slate-800 hover:bg-slate-900 text-white shadow-lg transition-colors"
          title="Åpne arkiv"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Archive className="h-6 w-6" />}
          {completedSubjectsCount > 0 && !isOpen && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {completedSubjectsCount}
            </span>
          )}
        </motion.button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        className="w-96 p-0 border-slate-200 rounded-2xl shadow-xl"
      >
        <div className="flex flex-col max-h-[60vh]">
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
          </div>

          {/* Content - Scrollable List */}
          <div className="flex-1 overflow-y-auto">
            {completedSubjects.length === 0 ? (
              <div className="text-center py-8 px-6">
                <Archive className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Ingen fullførte fag ennå
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {completedSubjects.map((subject) => {
                  const theme = getSubjectTheme(subject.color_theme || "gray");
                  const totalTasks = subject.tasks?.length || 0;
                  const completedTasks =
                    subject.tasks?.filter((t) => t.is_completed).length || 0;

                  return (
                    <Link
                      key={subject.id}
                      href={`/subject/${subject.id}`}
                      onClick={() => onOpenChange(false)}
                      className="block group"
                    >
                      <motion.div
                        whileHover={{ x: 4 }}
                        className={`p-3 rounded-lg border-2 ${theme.border} ${theme.light} hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xl flex-shrink-0">
                            {subject.emoji}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-slate-900 truncate">
                              {subject.title}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {completedTasks} av {totalTasks}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          ✓
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
