"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { SubjectTheme } from "@/utils/subject-colors";

interface ColorPickerGridProps {
  value: SubjectTheme;
  onChange: (color: SubjectTheme) => void;
  usedColors?: Set<SubjectTheme>;
}

// All Tailwind color families
const TAILWIND_COLORS: SubjectTheme[] = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

// Map colors to their 500 shade hex values for preview
const COLOR_HEX: Record<SubjectTheme, string> = {
  slate: "#64748b",
  gray: "#6b7280",
  zinc: "#71717a",
  neutral: "#737373",
  stone: "#78716c",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
};

// Capitalize first letter for display
const formatColorName = (color: string) =>
  color.charAt(0).toUpperCase() + color.slice(1);

export function ColorPickerGrid({
  value,
  onChange,
  usedColors = new Set(),
}: ColorPickerGridProps) {
  const [open, setOpen] = useState(false);

  // Sort colors: available first, used last
  const availableColors = TAILWIND_COLORS.filter((c) => !usedColors.has(c));
  const usedColorsList = TAILWIND_COLORS.filter((c) => usedColors.has(c));
  const sortedColors = [...availableColors, ...usedColorsList];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 h-10"
          type="button"
        >
          <div
            className="w-5 h-5 rounded-full border border-slate-300"
            style={{ backgroundColor: COLOR_HEX[value] }}
          />
          <span className="text-sm font-medium">{formatColorName(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Velg farge
          </p>
          <div className="grid grid-cols-6 gap-2">
            {sortedColors.map((color) => {
              const isUsed = usedColors.has(color);
              const isSelected = value === color;

              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    if (!isUsed) {
                      onChange(color);
                      setOpen(false);
                    }
                  }}
                  disabled={isUsed}
                  title={
                    isUsed
                      ? `${formatColorName(color)} (i bruk)`
                      : formatColorName(color)
                  }
                  className={`w-10 h-10 rounded-full transition-all ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-indigo-600 scale-110"
                      : ""
                  } ${
                    isUsed
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:scale-110 cursor-pointer hover:shadow-md"
                  }`}
                  style={{
                    backgroundColor: COLOR_HEX[color],
                  }}
                />
              );
            })}
          </div>
          {usedColorsList.length > 0 && (
            <p className="text-xs text-slate-500 italic">
              Nedtonede farger er allerede i bruk
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
