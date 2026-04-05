"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getSubjectTheme } from "@/utils/subject-colors";

interface SubjectCardProps {
  id: string;
  title: string;
  emoji: string;
  colorTheme: string;
  taskCount: number;
  completedCount: number;
  index: number; // Brukes for å lage litt "staggered" animasjon
  variant?: "default" | "archive"; // Variant for archive styling
}

export default function SubjectCard({
  id,
  title,
  emoji,
  colorTheme,
  taskCount,
  completedCount,
  index,
  variant = "default",
}: SubjectCardProps) {
  // Get the theme colors from the centralized system
  const theme = getSubjectTheme(colorTheme);

  // Beregn fremdrift i prosent
  const progress = taskCount > 0 ? (completedCount / taskCount) * 100 : 0;
  const isDone = taskCount > 0 && taskCount === completedCount;

  // Archive variant styling (desaturated, muted opacity)
  const isArchive = variant === "archive";
  const archiveClasses = isArchive
    ? "opacity-60 hover:opacity-85 grayscale hover:grayscale-0 bg-white border-slate-200 transition-all duration-300"
    : "";

  // Modern high-contrast styling for active cards
  const cardBackground = isArchive
    ? archiveClasses
    : `bg-white border-2 border-opacity-60 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-[50ms] ease-linear`;

  // Get vibrant border color for active cards (use pre-defined border class)
  const borderColor = isArchive ? "border-slate-200" : theme.border;

  return (
    <Link href={`/subject/${id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { delay: index * 0.05, duration: 0.35, ease: "easeOut" },
        }}
        whileHover={{
          scale: 1.02,
          rotate: 0,
          zIndex: 10,
          transition: { duration: 0.05, ease: "linear" },
        }}
        whileTap={{ scale: 0.98 }}
        style={{ rotate: index % 2 === 0 ? 1 : -1 }}
        className={`relative p-4 sm:p-6 rounded-2xl cursor-pointer aspect-[3/2] sm:aspect-square w-full flex flex-col justify-between overflow-hidden ${cardBackground} ${borderColor}`}
      >
        {/* Subtle subject-tinted wash behind content */}
        <div
          className={`absolute inset-0 pointer-events-none opacity-60 ${theme.light} z-0`}
        />
        {/* Header */}
        <div className="flex justify-between items-start z-10">
          <div className="text-3xl sm:text-4xl filter drop-shadow-sm">
            {emoji}
          </div>
          {isDone && (
            <div className="bg-white/50 p-1.5 rounded-full">
              <CheckCircle2 className="w-6 h-6 opacity-75" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="z-10">
          <h3
            className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${theme.text}`}
          >
            {title}
          </h3>
          <p className="text-sm text-slate-600 font-medium flex items-center gap-2">
            {isDone
              ? "Alt ferdig! 🎉"
              : `${completedCount} av ${taskCount} oppgaver ferdig`}
          </p>
        </div>

        {/* Progress Bar or Status Badge */}
        {isArchive ? (
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-slate-200/40 flex items-center justify-center text-xs font-semibold text-slate-500">
            Ferdig ✓
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gray-200/50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full ${theme.progress}`}
            />
          </div>
        )}

        {/* Dekorativ sirkel i bakgrunnen */}
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none z-0" />

        {/* Handlings-ikon */}
        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight />
        </div>
      </motion.div>
    </Link>
  );
}
