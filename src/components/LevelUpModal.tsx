"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useAvailableRewards } from "@/hooks/useAvailableRewards";
import Toast from "@/components/ui/Toast";
import PaintBrushCursor from "./PaintBrushCursor";
import CelebrationStep from "./level-up/CelebrationStep";
import ColorPickerStep from "./level-up/ColorPickerStep";
import BloomStep from "./level-up/BloomStep";

type RewardType = "petal" | "database";

type LevelUpModalProps = {
  isOpen: boolean;
  newLevel: number;
  onClose: () => void;
  onSelectReward: (
    rewardType: RewardType,
    payload?: string,
    petalIndex?: number,
    rewardId?: string,
  ) => void;
  existingPetals: number;
  existingColors: string[];
  showFlowerGarden?: boolean;
  studentId?: string;
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
  showFlowerGarden = false,
  studentId,
}: LevelUpModalProps) {
  const [step, setStep] = useState<"celebration" | "colorPicker" | "bloom">(
    "celebration",
  );
  const [selectedReward, setSelectedReward] = useState<RewardType | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [hoveredPetalIndex, setHoveredPetalIndex] = useState<number | null>(
    null,
  );
  const [isAnimatingSuccess, setIsAnimatingSuccess] = useState<boolean>(false);
  const { rewards, loading: loadingRewards } = useAvailableRewards(
    studentId,
    isOpen && step === "celebration",
  );
  const [savingReward, setSavingReward] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const normalizeColors = (arr: string[]) =>
    Array.from({ length: 5 }, (_, i) => arr[i] || "#E0E0E0");
  const [modalColors, setModalColors] = useState<string[]>(
    normalizeColors(existingColors),
  );
  const [isBloomAnimating, setIsBloomAnimating] = useState(false);
  const [bloomColorsSnapshot, setBloomColorsSnapshot] = useState<string[]>([]);

  // Deferred reward callback — stashed during bloom, fired on dismiss
  const deferredRewardRef = useRef<(() => void) | null>(null);

  // Full state reset whenever the modal opens (fixes stale step after
  // parent closes the modal via isOpen=false without calling handleClose)
  useEffect(() => {
    if (isOpen) {
      setStep("celebration");
      setSelectedReward(null);
      setSelectedColor(null);
      setHoveredPetalIndex(null);
      setIsAnimatingSuccess(false);
      setIsBloomAnimating(false);
      setBloomColorsSnapshot([]);
      setSavingReward(false);
      deferredRewardRef.current = null;
      setModalColors(normalizeColors(existingColors));
    }
  }, [isOpen, existingColors]);

  const handleRewardSelect = async (
    rewardType: RewardType,
    rewardId?: string,
  ) => {
    if (rewardType === "petal") {
      setSelectedReward(rewardType);
      setStep("colorPicker");
    } else if (rewardType === "database" && rewardId && studentId) {
      // Delegate reward persistence to the hook (useTaskCompletion.selectReward)
      setSavingReward(true);
      try {
        // Show success feedback with confetti
        setIsAnimatingSuccess(true);

        // Close after showing success animation — hook handles DB insert
        setTimeout(() => {
          onSelectReward(rewardType, undefined, undefined, rewardId);
          handleClose();
        }, 1000);
      } finally {
        setSavingReward(false);
      }
    }
  };

  const handlePetalConfirm = (index: number) => {
    if (!selectedColor || !selectedReward) return;
    // Optimistically color the clicked petal in the modal before the success pulse
    const newColors = [...modalColors];
    newColors[index] = selectedColor;
    setModalColors(newColors);

    // Detect flower completion (all 5 petals now have colors)
    const filledCount = newColors.filter(
      (c) => c && c.trim().length > 0 && c.trim() !== "#E0E0E0",
    ).length;
    const isFlowerComplete = filledCount >= 5;

    setIsAnimatingSuccess(true);
    // Delay to let the petal splash animation play
    setTimeout(() => {
      if (isFlowerComplete) {
        // Defer the reward callback — it will be fired when the user
        // dismisses the bloom step.  This prevents the parent from
        // closing the modal mid-bloom animation.
        const rewardType = selectedReward;
        const color = selectedColor;
        deferredRewardRef.current = () =>
          onSelectReward(rewardType!, color!, index);

        // Snapshot colors for the bloom step, then transition
        setBloomColorsSnapshot(newColors);
        setIsAnimatingSuccess(false);
        setStep("bloom");
        setIsBloomAnimating(true);

        // Fire canvas-confetti burst
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.5 },
          colors: newColors.filter((c) => c !== "#E0E0E0"),
        });
        // Second burst slightly delayed
        setTimeout(() => {
          confetti({
            particleCount: 80,
            spread: 120,
            origin: { y: 0.4, x: 0.6 },
          });
        }, 300);
      } else {
        // Non-flower-complete: persist immediately and close
        onSelectReward(selectedReward!, selectedColor!, index);
        handleClose();
      }
    }, 1500);
  };

  // Called by FlowerPot when the bloom animation sequence finishes
  const handleBloomComplete = useCallback(() => {
    setIsBloomAnimating(false);
  }, []);

  const handleDipBrush = (color: string) => {
    setSelectedColor(color);
  };

  /** Dismiss the bloom step — fire the deferred reward, then close. */
  const handleBloomDismiss = useCallback(() => {
    // Fire the stashed reward callback (persists petal + clears pending level)
    if (deferredRewardRef.current) {
      deferredRewardRef.current();
      deferredRewardRef.current = null;
    }
    handleClose();
  }, []);

  const handleClose = () => {
    setStep("celebration");
    setSelectedReward(null);
    setSelectedColor(null);
    setHoveredPetalIndex(null);
    setIsAnimatingSuccess(false);
    setIsBloomAnimating(false);
    setBloomColorsSnapshot([]);
    deferredRewardRef.current = null;
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="level-up-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            {/* Backdrop — no click-to-dismiss (too easy for kids to misclick;
                pending reward persists in DB so nothing is lost) */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Confetti (Step 1 only) */}
            {step === "celebration" && (
              <Confetti
                width={typeof window !== "undefined" ? window.innerWidth : 300}
                height={
                  typeof window !== "undefined" ? window.innerHeight : 300
                }
                recycle={false}
                numberOfPieces={500}
                gravity={0.3}
              />
            )}

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={`relative z-10 bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-4xl w-full mx-3 sm:mx-4 md:mx-6 p-4 sm:p-6 md:p-8 lg:p-12 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-y-auto ${
                step === "colorPicker" ? "cursor-none [&_*]:cursor-none" : ""
              }`}
            >
              {/* Paint Brush Cursor (only in color picker, not bloom) */}
              {step === "colorPicker" && (
                <PaintBrushCursor color={selectedColor} />
              )}
              {/* Close Button (hidden during bloom — use the dismiss button instead) */}
              {step !== "bloom" && (
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600" />
                </button>
              )}

              {/* Step 1: Celebration */}
              {step === "celebration" && (
                <CelebrationStep
                  newLevel={newLevel}
                  showFlowerGarden={showFlowerGarden}
                  rewards={rewards}
                  loadingRewards={loadingRewards}
                  savingReward={savingReward}
                  onSelectPetal={() => handleRewardSelect("petal")}
                  onSelectDatabaseReward={(rewardId) =>
                    handleRewardSelect("database", rewardId)
                  }
                />
              )}

              {/* Step 2: Color Picker — Paint Studio */}
              {step === "colorPicker" && (
                <ColorPickerStep
                  colorPalette={colorPalette}
                  selectedColor={selectedColor}
                  modalColors={modalColors}
                  hoveredPetalIndex={hoveredPetalIndex}
                  setHoveredPetalIndex={setHoveredPetalIndex}
                  isAnimatingSuccess={isAnimatingSuccess}
                  onPetalConfirm={handlePetalConfirm}
                  onDipBrush={handleDipBrush}
                  onBack={() => {
                    setStep("celebration");
                    setSelectedColor(null);
                  }}
                />
              )}

              {/* Step 3: Bloom Celebration */}
              {step === "bloom" && (
                <BloomStep
                  bloomColorsSnapshot={bloomColorsSnapshot}
                  isBloomAnimating={isBloomAnimating}
                  onBloomComplete={handleBloomComplete}
                  onDismiss={handleBloomDismiss}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast toast={toast} onClose={hideToast} />
    </>
  );
}
