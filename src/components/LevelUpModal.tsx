"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import confetti from "canvas-confetti";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import PaintBrushCursor from "./PaintBrushCursor";
import FlowerPot from "./FlowerPot";

type RewardType = "petal" | "database";

type Reward = {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  is_recurring?: boolean;
};

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
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const normalizeColors = (arr: string[]) =>
    Array.from({ length: 5 }, (_, i) => arr[i] || "#E0E0E0");
  const [modalColors, setModalColors] = useState<string[]>(
    normalizeColors(existingColors),
  );
  const [isBloomAnimating, setIsBloomAnimating] = useState(false);
  const [bloomColorsSnapshot, setBloomColorsSnapshot] = useState<string[]>([]);

  // Fetch rewards from database when modal opens
  useEffect(() => {
    if (isOpen && step === "celebration") {
      const fetchRewards = async () => {
        setLoadingRewards(true);
        try {
          const supabase = createClient();

          // Fetch rewards that are either:
          // 1. Available to all students (specific_student_ids is empty array)
          // 2. Specifically assigned to this student (array contains studentId)
          const [rewardsRes, earnedRes] = await Promise.all([
            supabase
              .from("rewards")
              .select("*")
              .or(
                `specific_student_ids.eq.{},specific_student_ids.cs.{${studentId}}`,
              )
              .order("created_at", { ascending: true }),
            // Also fetch reward_ids this student has already earned
            supabase
              .from("student_rewards")
              .select("reward_id")
              .eq("student_id", studentId ?? ""),
          ]);

          if (!rewardsRes.error && rewardsRes.data) {
            // Count how many times each reward has been earned
            const earnedCounts = new Map<string, number>();
            for (const r of earnedRes.data ?? []) {
              earnedCounts.set(r.reward_id, (earnedCounts.get(r.reward_id) ?? 0) + 1);
            }

            // Filter out rewards that have reached their max_uses limit
            const filtered = rewardsRes.data.filter((r) => {
              if (r.max_uses == null) return true; // unlimited
              const used = earnedCounts.get(r.id) ?? 0;
              return used < r.max_uses;
            });
            setRewards(filtered);
          }
        } catch {
          // Silent — reward fetch is non-critical
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
      // Always persist the reward
      onSelectReward(selectedReward, selectedColor, index);

      if (isFlowerComplete) {
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

  const handleClose = () => {
    setStep("celebration");
    setSelectedReward(null);
    setSelectedColor(null);
    setHoveredPetalIndex(null);
    setIsAnimatingSuccess(false);
    setIsBloomAnimating(false);
    setBloomColorsSnapshot([]);
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
                      style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                      }}
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
                                  (showFlowerGarden
                                    ? index * 0.1
                                    : index * 0.1),
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
                                  : reward.description ||
                                    "En fantastisk premie!"}
                              </p>
                            </motion.button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Color Picker — Paint Studio */}
              {step === "colorPicker" && (
                <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 md:space-y-6">
                  {/* Animated emoji cue — replaces text instructions */}
                  <motion.div
                    initial={{ opacity: 1, y: 0 }}
                    animate={
                      selectedColor
                        ? { opacity: 0, y: -12, scale: 0.8 }
                        : {
                            opacity: [1, 1, 0.6],
                            y: [0, -8, 0],
                          }
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
                        modalColors.filter((c) => c && c.trim().length > 0)
                          .length
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
                        background:
                          "radial-gradient(ellipse, #B8860B 0%, #A0826D 100%)",
                      }}
                    />
                    {/* Paint blob swatches */}
                    <div className="relative flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4">
                      {colorPalette.map((color, index) => {
                        const isSelected = selectedColor === color.hex;
                        // Each blob gets a unique rotation for organic feel
                        const blobRotation =
                          [0, -15, 12, -8, 20, -12, 8, -20][index] ?? 0;
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

                        return (
                          <motion.button
                            key={color.hex}
                            initial={{
                              scale: 0,
                              opacity: 0,
                              rotate: blobRotation,
                            }}
                            animate={{
                              scale: 1,
                              opacity: 1,
                              rotate: blobRotation,
                            }}
                            transition={{
                              delay: 0.3 + index * 0.06,
                              type: "spring",
                              stiffness: 200,
                            }}
                            whileHover={{
                              scale: 1.15,
                              rotate: blobRotation + 5,
                            }}
                            whileTap={{
                              scaleX: 1.1,
                              scaleY: 0.85,
                              rotate: blobRotation - 3,
                            }}
                            onClick={() => handleDipBrush(color.hex)}
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
                                stroke={
                                  isSelected ? "#1F2937" : "rgba(0,0,0,0.15)"
                                }
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

              {/* Step 3: Bloom Celebration — flower is complete! */}
              {step === "bloom" && (
                <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-4 sm:py-6">
                  {/* Rainbow celebration text */}
                  <motion.h2
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      delay: 0.3,
                      type: "spring",
                      damping: 15,
                      stiffness: 200,
                    }}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-transparent bg-clip-text text-center select-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #f87171, #facc15, #4ade80, #60a5fa, #a855f7)",
                    }}
                  >
                    Ny blomst i hagen! 🌺
                  </motion.h2>

                  {/* Blooming flower */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex justify-center"
                  >
                    <FlowerPot
                      size={
                        typeof window !== "undefined" && window.innerWidth < 640
                          ? 200
                          : 280
                      }
                      petalsFilled={5}
                      colors={bloomColorsSnapshot}
                      isInteractive={false}
                      hasPaint={false}
                      isBloomAnimating={isBloomAnimating}
                      onBloomComplete={handleBloomComplete}
                    />
                  </motion.div>

                  {/* Flowers collected count */}
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="text-base sm:text-lg text-gray-600 font-medium"
                  >
                    🌸🌺🌼
                  </motion.p>

                  {/* Dismiss button (appears after bloom animation) */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.5 }}
                    onClick={handleClose}
                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white rounded-xl md:rounded-2xl font-bold text-sm sm:text-base shadow-lg transition-colors"
                  >
                    Fantastisk! ✨
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast toast={toast} onClose={hideToast} />
    </>
  );
}
