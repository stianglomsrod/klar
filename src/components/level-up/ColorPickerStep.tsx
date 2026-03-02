"use client";

import { motion } from "framer-motion";
import FlowerPot from "../FlowerPot";

// ── Types ────────────────────────────────────────────

type ColorEntry = { name: string; hex: string };

type ColorPickerStepProps = {
  colorPalette: ColorEntry[];
  selectedColor: string | null;
  modalColors: string[];
  hoveredPetalIndex: number | null;
  setHoveredPetalIndex: (index: number | null) => void;
  isAnimatingSuccess: boolean;
  onPetalConfirm: (index: number) => void;
  onDipBrush: (color: string) => void;
  onBack: () => void;
};

// ── Component ────────────────────────────────────────

export default function ColorPickerStep({
  colorPalette,
  selectedColor,
  modalColors,
  hoveredPetalIndex,
  setHoveredPetalIndex,
  isAnimatingSuccess,
  onPetalConfirm,
  onDipBrush,
  onBack,
}: ColorPickerStepProps) {
  // Unique irregular blob SVG paths (48×48 viewBox)
  const blobPaths = [
    "M24,4 C34,2 44,12 42,24 C40,36 28,46 18,42 C6,38 2,26 6,16 C10,6 16,6 24,4Z",
    "M20,2 C32,0 46,8 44,22 C42,36 32,48 18,44 C4,40 0,28 4,14 C8,4 12,4 20,2Z",
    "M26,6 C36,3 46,14 44,28 C42,40 30,47 16,44 C4,39 1,26 5,14 C9,5 18,8 26,6Z",
    "M22,3 C34,0 48,10 46,26 C44,40 32,48 18,46 C6,42 0,28 4,16 C8,6 14,5 22,3Z",
    "M28,5 C38,3 47,14 44,28 C40,42 28,47 14,44 C2,38 0,24 6,12 C12,3 20,7 28,5Z",
    "M20,5 C30,1 44,8 46,22 C48,36 36,47 22,46 C8,44 1,32 3,18 C5,6 13,7 20,5Z",
    "M24,3 C36,1 47,12 46,26 C44,42 30,48 16,46 C4,42 0,28 4,14 C8,4 16,5 24,3Z",
    "M22,5 C32,1 46,12 44,26 C42,40 28,47 14,44 C2,39 1,24 6,12 C12,3 16,7 22,5Z",
  ];

  // Each blob gets a unique rotation for organic feel
  const blobRotations = [0, -15, 12, -8, 20, -12, 8, -20];

  return (
    <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 md:space-y-6">
      {/* Animated emoji cue */}
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        animate={
          selectedColor
            ? { opacity: 0, y: -12, scale: 0.8 }
            : { opacity: [1, 1, 0.6], y: [0, -8, 0] }
        }
        transition={
          selectedColor
            ? { duration: 0.4 }
            : { duration: 1.5, repeat: 2, ease: "easeInOut" }
        }
        className="text-3xl sm:text-4xl md:text-5xl select-none"
      >
        {selectedColor ? "🌸" : "🎨"}
      </motion.div>

      {/* Flower Pot - Interactive */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center w-full max-w-[240px] sm:max-w-[260px] md:max-w-[300px]"
      >
        <FlowerPot
          size={
            typeof window !== "undefined" && window.innerWidth < 640
              ? 180
              : window.innerWidth < 768
                ? 220
                : 260
          }
          petalsFilled={
            modalColors.filter((c) => c && c.trim().length > 0).length
          }
          colors={modalColors}
          isInteractive={true}
          hasPaint={!!selectedColor}
          onPetalClick={onPetalConfirm}
          hoveredPetalIndex={hoveredPetalIndex}
          setHoveredPetalIndex={setHoveredPetalIndex}
          isAnimatingSuccess={isAnimatingSuccess}
        />
      </motion.div>

      {/* Wood-grain Paint Palette */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative w-full max-w-lg mx-auto rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 shadow-xl overflow-visible"
        style={{
          background:
            "linear-gradient(155deg, #DEB887 0%, #C4914B 25%, #D2A069 50%, #C4914B 75%, #DEB887 100%)",
        }}
      >
        {/* Wood grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(95deg, transparent, transparent 12px, rgba(139,69,19,0.3) 12px, rgba(139,69,19,0.3) 13px)",
          }}
        />
        {/* Paint palette thumb hole */}
        <div
          className="absolute bottom-2 right-3 sm:bottom-3 sm:right-4 w-8 h-10 sm:w-10 sm:h-12 rounded-full border-2 border-[#8B5A2B]/40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse, #B8860B 0%, #A0826D 100%)",
          }}
        />
        {/* Paint blob swatches */}
        <div className="relative flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4">
          {colorPalette.map((color, index) => {
            const isSelected = selectedColor === color.hex;
            const blobRotation = blobRotations[index] ?? 0;

            return (
              <motion.button
                key={color.hex}
                initial={{ scale: 0, opacity: 0, rotate: blobRotation }}
                animate={{ scale: 1, opacity: 1, rotate: blobRotation }}
                transition={{
                  delay: 0.3 + index * 0.06,
                  type: "spring",
                  stiffness: 200,
                }}
                whileHover={{ scale: 1.15, rotate: blobRotation + 5 }}
                whileTap={{
                  scaleX: 1.1,
                  scaleY: 0.85,
                  rotate: blobRotation - 3,
                }}
                onClick={() => onDipBrush(color.hex)}
                className="relative flex-shrink-0 p-0 border-0 bg-transparent"
                style={{
                  width: "clamp(44px, 10vw, 56px)",
                  height: "clamp(44px, 10vw, 56px)",
                }}
                aria-label={color.name}
              >
                <svg
                  viewBox="0 0 48 48"
                  className="w-full h-full drop-shadow-md"
                >
                  <path
                    d={blobPaths[index]}
                    fill={color.hex}
                    stroke={isSelected ? "#1F2937" : "rgba(0,0,0,0.15)"}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  {/* Highlight shine on blob */}
                  <ellipse
                    cx="18"
                    cy="16"
                    rx="5"
                    ry="4"
                    fill="white"
                    opacity="0.35"
                    transform="rotate(-20 18 16)"
                  />
                </svg>
                {/* Selected checkmark */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-white text-base sm:text-lg font-bold drop-shadow-lg">
                      ✓
                    </span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={onBack}
        className="px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 md:py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg md:rounded-xl font-semibold text-sm sm:text-base text-gray-700 transition-colors"
      >
        Tilbake
      </motion.button>
    </div>
  );
}
