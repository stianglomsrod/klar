"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";

type TTSButtonProps = {
  text: string;
  /** Additional size class override (default: w-8 h-8) */
  className?: string;
  /** Variant: 'default' for grey, 'light' for white/transparent on dark bg */
  variant?: "default" | "light";
};

/**
 * A small listen-button that reads the given text aloud in Norwegian
 * using the browser's Web Speech API. Mimics the ear/speaker icon
 * pattern from Skolestudio.
 */
export default function TTSButton({
  text,
  className = "",
  variant = "default",
}: TTSButtonProps) {
  const { speak, isSpeaking } = useTTS();

  const baseStyles =
    variant === "light"
      ? "text-white/70 hover:text-white hover:bg-white/20"
      : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50";

  const activeStyles =
    variant === "light"
      ? "!text-white !bg-white/30"
      : "!text-indigo-600 !bg-indigo-100";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      title={isSpeaking ? "Stopp opplessing" : "Les opp teksten"}
      className={`
        inline-flex items-center justify-center rounded-full p-1.5
        transition-all duration-200 flex-shrink-0
        ${baseStyles}
        ${isSpeaking ? `${activeStyles} animate-pulse` : ""}
        ${className}
      `}
    >
      {isSpeaking ? (
        <VolumeX className="h-5 w-5" />
      ) : (
        <Volume2 className="h-5 w-5" />
      )}
    </button>
  );
}
