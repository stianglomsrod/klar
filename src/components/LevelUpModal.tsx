"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import { X } from "lucide-react";
import PaintBrushCursor from "./PaintBrushCursor";
import FlowerPot from "./FlowerPot";

type RewardType = "petal" | "uno" | "break";

type LevelUpModalProps = {
  isOpen: boolean;
  newLevel: number;
  onClose: () => void;
  onSelectReward: (rewardType: RewardType, payload?: string, petalIndex?: number) => void;
  existingPetals: number;
  existingColors: string[];
};

const colorPalette = [
  { name: "Rød", hex: "#FF6B6B" },
  { name: "Blå", hex: "#4ECDC4" },
  { name: "Grønn", hex: "#90EE90" },
  { name: "Rosa", hex: "#FF69B4" },
  { name: "Lilla", hex: "#9B59B6" },
  { name: "Oransje", hex: "#FFA500" },
  { name: "Gul", hex: "#FFD700" },
  { name: "Turkis", hex: "#45B7D1" },
];

export default function LevelUpModal({
  isOpen,
  newLevel,
  onClose,
  onSelectReward,
  existingPetals,
  existingColors,
}: LevelUpModalProps) {
  const [step, setStep] = useState<"celebration" | "colorPicker">(
    "celebration"
  );
  const [selectedReward, setSelectedReward] = useState<RewardType | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [hoveredPetalIndex, setHoveredPetalIndex] = useState<number | null>(null);
  const [isAnimatingSuccess, setIsAnimatingSuccess] = useState<boolean>(false);
  const normalizeColors = (arr: string[]) => Array.from({ length: 5 }, (_, i) => arr[i] || "");
  const [modalColors, setModalColors] = useState<string[]>(normalizeColors(existingColors));

  // Re-sync local colors when modal opens or existing colors change
  useEffect(() => {
    if (isOpen) {
      setModalColors(normalizeColors(existingColors));
    }
  }, [isOpen, existingColors]);

  const handleRewardSelect = (rewardType: RewardType) => {
    if (rewardType === "petal") {
      setSelectedReward(rewardType);
      setStep("colorPicker");
    } else {
      // For future rewards, just call directly
      onSelectReward(rewardType);
    }
  };

  const handleColorSelect = (color: string) => {
    if (selectedReward) {
      onSelectReward(selectedReward, color);
      handleClose();
    }
  };

  const handlePetalConfirm = (index: number) => {
    if (!selectedColor || !selectedReward) return;
    // Optimistically color the clicked petal in the modal before the success pulse
    setModalColors((prev) => {
      const next = [...prev];
      next[index] = selectedColor!;
      return next;
    });
    setIsAnimatingSuccess(true);
    // Optional success sound
    try {
      const audio = new Audio("/sounds/success.mp3");
      audio.play().catch(() => {});
    } catch {}
    // Delay closing to let the pulse animation play
    setTimeout(() => {
      onSelectReward(selectedReward, selectedColor, index);
      handleClose();
    }, 1500);
  };

  const handleDipBrush = (color: string) => {
    setSelectedColor(color);
    // Play confirmation animation
    try {
      const audio = new Audio("/sounds/dip.mp3");
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  };

  const handleClose = () => {
    setStep("celebration");
    setSelectedReward(null);
    setSelectedColor(null);
    setHoveredPetalIndex(null);
    setIsAnimatingSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Confetti (Step 1 only) */}
        {step === "celebration" && (
          <Confetti
            width={typeof window !== "undefined" ? window.innerWidth : 300}
            height={typeof window !== "undefined" ? window.innerHeight : 300}
            recycle={false}
            numberOfPieces={500}
            gravity={0.3}
          />
        )}

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className={`relative z-10 bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 p-8 md:p-12 ${
            step === "colorPicker" ? "cursor-none [&_*]:cursor-none" : ""
          }`}
        >
          {/* Paint Brush Cursor (only in color picker) */}
          {step === "colorPicker" && <PaintBrushCursor color={selectedColor} />}
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>

          {/* Step 1: Celebration */}
          {step === "celebration" && (
            <div className="text-center">
              {/* Header */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 mb-4">
                  GRATULERER! 🎉
                </h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl md:text-3xl font-bold text-gray-800 mb-2"
                >
                  Du er nå i Level {newLevel}!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-lg text-gray-600 mb-8"
                >
                  Velg din premie:
                </motion.p>
              </motion.div>

              {/* Reward Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Flower Reward */}
                <motion.button
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRewardSelect("petal")}
                  className="bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-300 hover:border-pink-400 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <div className="text-6xl mb-3">🌸</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Fargelegg Kronblad
                  </h3>
                  <p className="text-sm text-gray-600">
                    Velg en farge til blomsten din
                  </p>
                </motion.button>

                {/* Uno Reward - Disabled */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="bg-gray-100 border-2 border-gray-200 rounded-2xl p-6 shadow-lg opacity-60 cursor-not-allowed"
                >
                  <div className="text-6xl mb-3">🃏</div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">
                    Ett spill Uno
                  </h3>
                  <p className="text-sm text-gray-500">Kommer snart</p>
                </motion.div>

                {/* Break Reward - Disabled */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="bg-gray-100 border-2 border-gray-200 rounded-2xl p-6 shadow-lg opacity-60 cursor-not-allowed"
                >
                  <div className="text-6xl mb-3">⚽</div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">
                    5 min ekstra fri
                  </h3>
                  <p className="text-sm text-gray-500">Kommer snart</p>
                </motion.div>
              </div>
            </div>
          )}

          {/* Step 2: Color Picker */}
          {step === "colorPicker" && (
            <div className="flex flex-col items-center justify-center space-y-8">
              {/* Instructions */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
                  {selectedColor
                    ? "Mal det ledige kronbladet! 🌸"
                    : "Dypp penselen i en farge! 👇"}
                </p>
                {!selectedColor && (
                  <p className="text-sm text-gray-600">
                    Velg en farge fra paletten under
                  </p>
                )}
              </motion.div>

              {/* Flower Pot - Interactive */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <FlowerPot
                  size={280}
                    petalsFilled={modalColors.filter((c) => c && c.trim().length > 0).length}
                    colors={modalColors}
                  isInteractive={true}
                  hasPaint={!!selectedColor}
                  onPetalClick={handlePetalConfirm}
                  hoveredPetalIndex={hoveredPetalIndex}
                  setHoveredPetalIndex={setHoveredPetalIndex}
                  isAnimatingSuccess={isAnimatingSuccess}
                />
              </motion.div>

              {/* Color Palette - Dipping Area */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap justify-center gap-4 md:gap-6 bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300 w-full"
              >
                {colorPalette.map((color, index) => (
                  <motion.button
                    key={color.hex}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.3 + index * 0.05,
                      type: "spring",
                      stiffness: 200,
                    }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDipBrush(color.hex)}
                    className={`h-16 w-16 md:h-20 md:w-20 rounded-full shadow-lg transition-all ${
                      selectedColor === color.hex
                        ? "ring-4 ring-offset-2 ring-gray-800 scale-110"
                        : "hover:shadow-xl"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {selectedColor === color.hex && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center justify-center h-full text-white font-bold text-sm drop-shadow-lg"
                      >
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </motion.div>

              {/* Back Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => {
                  setStep("celebration");
                  setSelectedColor(null);
                }}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-semibold text-gray-700 transition-colors"
              >
                Tilbake
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
