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
  variant?: "default" | "trophy"; // Variant for trophy shelf styling
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

  // Trophy variant styling
  const isTrophy = variant === "trophy";
  const trophyClasses = isTrophy
    ? "opacity-80 hover:opacity-100 border-yellow-300 bg-yellow-50/50"
    : "";

  // Use theme light background and border, or trophy styling
  const cardBackground = isTrophy
    ? trophyClasses
    : `${theme.light} border-2 ${theme.border}`;

  return (
    <Link href={`/subject/${id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
        whileTap={{ scale: 0.95 }}
        style={{ rotate: index % 2 === 0 ? 1 : -1 }}
        className={`relative p-6 rounded-[2rem] shadow-sm border-2 cursor-pointer aspect-square w-full flex flex-col justify-between overflow-hidden ${cardBackground}`}
      >
        {/* Header */}
        <div className="flex justify-between items-start z-10">
          <div className="text-4xl filter drop-shadow-sm">{emoji}</div>
          {isDone && (
            <div className="bg-white/50 p-1.5 rounded-full">
              <CheckCircle2 className="w-6 h-6 opacity-75" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="z-10">
          <h3 className="text-2xl font-bold tracking-tight mb-1">{title}</h3>
          <p className="text-sm opacity-80 font-medium flex items-center gap-2">
            {isDone
              ? "Alt ferdig! 🎉"
              : `${completedCount} av ${taskCount} oppgaver ferdig`}
          </p>
        </div>

        {/* Progress Bar inne i kortet (or Trophy Badge) */}
        {isTrophy ? (
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-yellow-200 to-yellow-100 flex items-center justify-center text-xs font-bold text-yellow-700">
            Fullført! 🌟
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
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />

        {/* Handlings-ikon */}
        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight />
        </div>
      </motion.div>
    </Link>
  );
}
