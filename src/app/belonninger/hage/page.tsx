"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import FlowerPot from "@/components/FlowerPot";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { createClient } from "@/utils/supabase/client";

const DEFAULT_PETAL_COLORS = [
  "#E0E0E0",
  "#E0E0E0",
  "#E0E0E0",
  "#E0E0E0",
  "#E0E0E0",
];

/**
 * Deterministic pseudo-random positioning for garden flowers.
 * Used as fallback when a flower has no saved position.
 * Each flower gets a unique but stable position on the hills
 * based on its index, avoiding rigid grid layout.
 */
function getFlowerPlacement(index: number, _total: number) {
  const baseX = ((index % 7) / 6) * 80 + 10;
  const jitterX = ((Math.sin(index * 2.654) + 1) / 2) * 10 - 5;
  const x = Math.min(92, Math.max(8, baseX + jitterX));

  const row = Math.floor(index / 7);
  const baseY = 20 + row * 22;
  const jitterY = ((Math.cos(index * 3.927) + 1) / 2) * 12 - 6;
  const y = Math.min(85, Math.max(12, baseY + jitterY));

  const scale = 0.55 + (1 - y / 100) * 0.45;
  const rotation = Math.sin(index * 1.337) * 6;

  return { x, y, scale, rotation, zIndex: Math.round(y) };
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function GardenPage() {
  const { profile, loading, setProfile } = useStudentProfile();
  const [tappedFlower, setTappedFlower] = useState<number | null>(null);
  const gardenRef = useRef<HTMLDivElement>(null);

  const petalsFilled = Math.max(0, Math.min(5, profile?.petals_progress ?? 0));
  const petalColors = useMemo(() => {
    const base =
      profile?.petal_colors && profile.petal_colors.length > 0
        ? profile.petal_colors
        : DEFAULT_PETAL_COLORS;
    return [...base, ...DEFAULT_PETAL_COLORS].slice(0, 5);
  }, [profile?.petal_colors]);

  const completedFlowers = useMemo(
    () => profile?.completed_flower_colors ?? [],
    [profile?.completed_flower_colors],
  );

  /**
   * Persist a flower's position (as percentage of container)
   * to Supabase and update local state.
   */
  const saveFlowerPosition = useCallback(
    async (flowerIndex: number, xPct: number, yPct: number) => {
      if (!profile) return;

      const updated: Record<string, { x: number; y: number }> = {
        ...profile.garden_positions,
        [String(flowerIndex)]: { x: xPct, y: yPct },
      };

      // Optimistic local update
      setProfile((prev) =>
        prev ? { ...prev, garden_positions: updated } : prev,
      );

      const supabase = createClient();
      await supabase
        .from("student_profiles")
        .update({ garden_positions: updated })
        .eq("id", profile.id);
    },
    [profile, setProfile],
  );

  /**
   * Handle drag end: convert pixel offset to percentage
   * relative to the garden container.
   */
  const handleDragEnd = useCallback(
    (index: number, info: PanInfo, startX: number, startY: number) => {
      const container = gardenRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const pxX = (startX / 100) * rect.width + info.offset.x;
      const pxY = (startY / 100) * rect.height + info.offset.y;

      const newX = clamp((pxX / rect.width) * 100, 4, 96);
      const newY = clamp((pxY / rect.height) * 100, 4, 96);

      saveFlowerPosition(index, newX, newY);
    },
    [saveFlowerPosition],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-200 to-green-200">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-green-800 text-lg font-medium"
        >
          Laster hagen din...
        </motion.p>
      </div>
    );
  }

  if (!profile?.show_flower_garden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-200 to-green-200">
        <div className="text-center bg-white/80 backdrop-blur rounded-2xl p-8 shadow-lg mx-4">
          <p className="text-4xl mb-4">🌱</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Blomsterhagen er ikke aktivert
          </h1>
          <p className="text-gray-600 mb-6">
            Be læreren din om å aktivere blomsterhagen for deg.
          </p>
          <Link
            href="/belonninger"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-200 to-green-200">
        <p className="text-gray-600">Kunne ikke laste inn profil</p>
      </div>
    );
  }

  const hasFlowers = completedFlowers.length > 0;

  return (
    <div className="relative min-h-[calc(100vh-10rem)] overflow-hidden select-none">
      {/* ═══ Sky ═══ */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #87CEEB 0%, #B0E0F6 35%, #D4F0FF 60%, #E8F8E8 80%, #7CCD7C 90%, #5AAF5A 100%)",
        }}
      />

      {/* ═══ Clouds ═══ */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: "6%", left: "-10%" }}
        animate={{ x: ["0%", "120vw"] }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
      >
        <svg width="160" height="60" viewBox="0 0 160 60" fill="none">
          <ellipse cx="80" cy="35" rx="70" ry="25" fill="white" opacity="0.7" />
          <ellipse cx="50" cy="28" rx="40" ry="22" fill="white" opacity="0.8" />
          <ellipse
            cx="110"
            cy="30"
            rx="45"
            ry="20"
            fill="white"
            opacity="0.75"
          />
        </svg>
      </motion.div>
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: "12%", left: "30%" }}
        animate={{ x: ["0%", "80vw"] }}
        transition={{
          duration: 100,
          repeat: Infinity,
          ease: "linear",
          delay: 15,
        }}
      >
        <svg width="120" height="45" viewBox="0 0 120 45" fill="none">
          <ellipse cx="60" cy="25" rx="55" ry="20" fill="white" opacity="0.6" />
          <ellipse cx="35" cy="20" rx="30" ry="18" fill="white" opacity="0.7" />
          <ellipse
            cx="85"
            cy="22"
            rx="35"
            ry="16"
            fill="white"
            opacity="0.65"
          />
        </svg>
      </motion.div>

      {/* ═══ Sun ═══ */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: "3%", right: "8%" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="18" fill="#FFD700" />
          <circle cx="40" cy="40" r="22" fill="#FFD700" opacity="0.3" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={40 + Math.cos(angle) * 24}
                y1={40 + Math.sin(angle) * 24}
                x2={40 + Math.cos(angle) * 34}
                y2={40 + Math.sin(angle) * 34}
                stroke="#FFD700"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.7"
              />
            );
          })}
        </svg>
      </motion.div>

      {/* ═══ Rolling Hills (SVG background) ═══ */}
      <svg
        className="absolute bottom-0 left-0 w-full pointer-events-none"
        viewBox="0 0 1440 500"
        preserveAspectRatio="none"
        style={{ height: "65%" }}
      >
        <path
          d="M0,200 C240,100 480,280 720,160 C960,40 1200,200 1440,120 L1440,500 L0,500 Z"
          fill="#6DBF6D"
          opacity="0.5"
        />
        <path
          d="M0,280 C200,180 400,320 700,220 C1000,120 1200,300 1440,200 L1440,500 L0,500 Z"
          fill="#5AAF5A"
          opacity="0.7"
        />
        <path
          d="M0,340 C300,260 500,380 800,300 C1100,220 1300,360 1440,280 L1440,500 L0,500 Z"
          fill="#4A9F4A"
          opacity="0.85"
        />
        <path
          d="M0,400 C400,370 800,410 1440,380 L1440,500 L0,500 Z"
          fill="#3D8B3D"
        />
      </svg>

      {/* ═══ Back Button (floating) ═══ */}
      <Link
        href="/belonninger"
        className="absolute top-2 left-3 z-30 p-2 bg-white/70 backdrop-blur-sm rounded-full shadow-md hover:bg-white/90 transition-colors"
        title="Tilbake"
      >
        <ArrowLeft className="h-5 w-5 text-gray-700" />
      </Link>

      {/* ═══ Draggable Garden Flowers ═══ */}
      {hasFlowers && (
        <div
          ref={gardenRef}
          className="absolute inset-0"
          style={{ top: "18%" }}
        >
          {completedFlowers.map((flowerColors, index) => {
            // Use saved position if available, otherwise fall back to deterministic placement
            const saved = profile.garden_positions?.[String(index)];
            const fallback = getFlowerPlacement(index, completedFlowers.length);
            const posX = saved?.x ?? fallback.x;
            const posY = saved?.y ?? fallback.y;

            const scale = 0.55 + (1 - posY / 100) * 0.45;
            const rotation = saved ? 0 : fallback.rotation;
            const zIndex = Math.round(posY);

            const normalizedColors = [
              ...flowerColors,
              ...DEFAULT_PETAL_COLORS,
            ].slice(0, 5);

            return (
              <motion.div
                key={`garden-flower-${index}`}
                className="absolute cursor-grab active:cursor-grabbing touch-none"
                style={{
                  left: `${posX}%`,
                  top: `${posY}%`,
                  zIndex,
                  x: "-50%",
                  y: "-100%",
                }}
                drag
                dragMomentum={false}
                dragElastic={0.1}
                onDragEnd={(_e, info) => handleDragEnd(index, info, posX, posY)}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale, opacity: 1 }}
                transition={{
                  delay: 0.08 * index,
                  type: "spring",
                  stiffness: 180,
                  damping: 14,
                }}
                whileDrag={{ scale: scale * 1.15, zIndex: 100 }}
                onTap={() =>
                  setTappedFlower(tappedFlower === index ? null : index)
                }
              >
                {/* Gentle idle sway */}
                <motion.div
                  animate={{
                    rotate: [rotation - 2, rotation + 2, rotation - 2],
                  }}
                  transition={{
                    duration: 3 + (index % 3),
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <FlowerPot
                    petalsFilled={5}
                    colors={normalizedColors}
                    size={Math.round(70 * scale)}
                    isInteractive={false}
                  />
                </motion.div>

                {/* Sparkle on tap */}
                <AnimatePresence>
                  {tappedFlower === index && (
                    <motion.div
                      className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none"
                      initial={{ opacity: 0, y: 4, scale: 0.5 }}
                      animate={{ opacity: 1, y: -8, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.3 }}
                      transition={{ duration: 0.6 }}
                    >
                      <span className="text-lg drop-shadow">✨</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ Current Flower (foreground) ═══ */}
      <div className="relative z-20 flex flex-col items-center justify-end min-h-[calc(100vh-10rem)] pb-2 px-4">
        {/* Empty garden message */}
        {!hasFlowers && petalsFilled === 0 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-white/90 text-sm font-medium bg-green-800/40 backdrop-blur-sm px-4 py-2 rounded-full mb-4 shadow"
          >
            Fullfør oppgaver for å plante blomster! 🌱
          </motion.p>
        )}

        {/* The current unfinished flower — prominently displayed */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        >
          <FlowerPot
            petalsFilled={petalsFilled}
            colors={petalColors}
            size={
              typeof window !== "undefined" && window.innerWidth < 640
                ? 180
                : 220
            }
            isInteractive={false}
          />
        </motion.div>
      </div>
    </div>
  );
}
