"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import PaintBrushCursor from "./PaintBrushCursor";
import FlowerPot from "./FlowerPot";

type RewardType = "petal" | "database";

type Reward = {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
};

type LevelUpModalProps = {
  isOpen: boolean;
  newLevel: number;
  onClose: () => void;
  onSelectReward: (
    rewardType: RewardType,
    payload?: string,
    petalIndex?: number,
    rewardId?: string
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
  const [step, setStep] = useState<"celebration" | "colorPicker">(
    "celebration"
  );
  const [selectedReward, setSelectedReward] = useState<RewardType | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [hoveredPetalIndex, setHoveredPetalIndex] = useState<number | null>(
    null
  );
  const [isAnimatingSuccess, setIsAnimatingSuccess] = useState<boolean>(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const normalizeColors = (arr: string[]) =>
    Array.from({ length: 5 }, (_, i) => arr[i] || "#E0E0E0");
  const [modalColors, setModalColors] = useState<string[]>(
    normalizeColors(existingColors)
  );

  // Fetch rewards from database when modal opens
  useEffect(() => {
    if (isOpen && step === "celebration") {
      const fetchRewards = async () => {
        setLoadingRewards(true);
        try {
          const supabase = createClient();
          
          console.log("Fetching rewards for student:", studentId);
          
          // Fetch rewards that are either:
          // 1. Available to all students (specific_student_id IS NULL)
          // 2. Specifically assigned to this student (specific_student_id = studentId)
          const { data, error } = await supabase
            .from("rewards")
            .select("*")
            .or(`specific_student_id.is.null,specific_student_id.eq.${studentId}`)
            .order("created_at", { ascending: true });

          if (error) {
            console.error("Error fetching rewards:", error?.message || error);
            console.error("Full error object:", error);
          } else {
            console.log("Fetched rewards:", data);
            console.log("Total rewards found:", data?.length || 0);
            setRewards(data || []);
          }
        } catch (err) {
          console.error("Error fetching rewards:", err);
        } finally {
          setLoadingRewards(false);
        }
      };
      fetchRewards();
    }
  }, [isOpen, step, studentId]);

  // Re-sync local colors when modal opens or existing colors change
  useEffect(() => {
    if (isOpen) {
      setModalColors(normalizeColors(existingColors));
    }
  }, [isOpen, existingColors]);

  // Check scroll position to show/hide arrows
  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);
      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [rewards, showFlowerGarden]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 320; // Width of one card + gap
    const newScrollLeft =
      scrollContainerRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);
    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  const handleRewardSelect = async (
    rewardType: RewardType,
    rewardId?: string
  ) => {
    if (rewardType === "petal") {
      setSelectedReward(rewardType);
      setStep("colorPicker");
    } else if (rewardType === "database" && rewardId && studentId) {
      // Save database reward selection
      setSavingReward(true);
      try {
        const supabase = createClient();
        const { error } = await supabase.from("student_rewards").insert({
          student_id: studentId,
          reward_id: rewardId,
          is_redeemed: false,
          date_earned: new Date().toISOString(),
        });

        if (error) throw error;

        // Show success feedback with confetti
        setIsAnimatingSuccess(true);

        // Close after showing success animation
        setTimeout(() => {
          onSelectReward(rewardType, undefined, undefined, rewardId);
          handleClose();
        }, 1000);
      } catch (err) {
        console.error("Error saving reward:", err);
        alert("Noe gikk galt ved valg av premie. Prøv igjen.");
      } finally {
        setSavingReward(false);
      }
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
    // Delay closing to let the pulse animation play
    setTimeout(() => {
      onSelectReward(selectedReward, selectedColor, index);
      handleClose();
    }, 1500);
  };

  const handleDipBrush = (color: string) => {
    setSelectedColor(color);
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
          className={`relative z-10 bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-4xl w-full mx-3 sm:mx-4 md:mx-6 p-4 sm:p-6 md:p-8 lg:p-12 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-y-auto ${
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
            <div className="text-center flex flex-col overflow-hidden">
              {/* Header - Fixed at top */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex-shrink-0"
              >
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 mb-3 md:mb-4">
                  GRATULERER! 🎉
                </h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-2"
                >
                  Du er nå i Level {newLevel}!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-base sm:text-lg text-gray-600 mb-4 md:mb-6"
                >
                  Velg din premie:
                </motion.p>
              </motion.div>

              {/* Scrollable Reward Grid */}
              <div className="relative">
                {/* Left Arrow */}
                {canScrollLeft && (
                  <button
                    onClick={() => scroll("left")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                  </button>
                )}

                {/* Right Arrow */}
                {canScrollRight && (
                  <button
                    onClick={() => scroll("right")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700" />
                  </button>
                )}

                {/* Horizontal scroll container */}
                <div
                  ref={scrollContainerRef}
                  className="overflow-x-auto overflow-y-hidden scrollbar-hide"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  <div className="flex gap-2 sm:gap-3 md:gap-6 px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 min-w-min">
                    {/* Flower Reward - Only show if enabled */}
                    {showFlowerGarden && (
                      <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRewardSelect("petal")}
                        className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-300 hover:border-pink-400 rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                      >
                        <div className="text-4xl sm:text-5xl md:text-6xl mb-2 md:mb-3">
                          🌸
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 md:mb-2">
                          Fargelegg Kronblad
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Velg en farge til blomsten din
                        </p>
                      </motion.button>
                    )}

                    {/* Database Rewards */}
                    {loadingRewards ? (
                      <div className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 flex items-center justify-center py-8 sm:py-10 md:py-12">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-gray-500 text-center text-sm sm:text-base"
                        >
                          Laster premier...
                        </motion.div>
                      </div>
                    ) : rewards.length === 0 && !showFlowerGarden ? (
                      <div className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 flex items-center justify-center py-8 sm:py-10 md:py-12">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-gray-500 text-center text-sm sm:text-base"
                        >
                          Ingen premier tilgjengelig
                        </motion.div>
                      </div>
                    ) : (
                      rewards.map((reward, index) => (
                        <motion.button
                          key={reward.id}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay:
                              0.7 +
                              (showFlowerGarden ? index * 0.1 : index * 0.1),
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            handleRewardSelect("database", reward.id)
                          }
                          disabled={savingReward}
                          className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-64 bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-300 hover:border-blue-400 rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-4xl sm:text-5xl md:text-6xl mb-2 md:mb-3">
                            {savingReward ? "⏳" : reward.emoji || "🎁"}
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 md:mb-2">
                            {reward.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {savingReward
                              ? "Lagrer premie..."
                              : reward.description || "En fantastisk premie!"}
                          </p>
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Color Picker */}
          {step === "colorPicker" && (
            <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 md:space-y-6">
              {/* Instructions */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
                  {selectedColor
                    ? "Mal det ledige kronbladet! 🌸"
                    : "Dypp penselen i en farge! 👇"}
                </p>
                {!selectedColor && (
                  <p className="text-xs sm:text-sm text-gray-600">
                    Velg en farge fra paletten under
                  </p>
                )}
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
                className="flex flex-wrap justify-center items-center gap-2 sm:gap-2.5 md:gap-3 bg-gray-50 p-2.5 sm:p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-dashed border-gray-300 w-full max-w-xl mx-auto"
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
                    className={`h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 lg:h-16 lg:w-16 rounded-full shadow-lg transition-all flex-shrink-0 ${
                      selectedColor === color.hex
                        ? "ring-2 sm:ring-3 md:ring-4 ring-offset-2 ring-gray-800 scale-110"
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
                className="px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 md:py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg md:rounded-xl font-semibold text-sm sm:text-base text-gray-700 transition-colors"
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
