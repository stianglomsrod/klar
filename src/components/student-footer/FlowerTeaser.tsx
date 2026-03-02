"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import FlowerPot from "../FlowerPot";

type FlowerTeaserProps = {
  petalsProgress: number;
  petalColors: string[];
};

const DEFAULT_PETAL_COLOR = "#E0E0E0";

export default function FlowerTeaser({
  petalsProgress,
  petalColors,
}: FlowerTeaserProps) {
  const teaserColors = useMemo(() => {
    const base =
      petalColors.length > 0 ? petalColors : Array(5).fill(DEFAULT_PETAL_COLOR);
    return [...base, ...Array(5).fill(DEFAULT_PETAL_COLOR)].slice(0, 5);
  }, [petalColors]);

  const teaserFilled = Math.max(0, Math.min(5, petalsProgress));

  // Track petal changes for bounce animation
  const [teaserBounce, setTeaserBounce] = useState(false);
  const prevPetalsRef = useRef(petalsProgress);
  useEffect(() => {
    if (petalsProgress !== prevPetalsRef.current && petalsProgress > 0) {
      // Defer setState to avoid synchronous setState-in-effect (React 19)
      const startTimer = setTimeout(() => setTeaserBounce(true), 0);
      const endTimer = setTimeout(() => setTeaserBounce(false), 600);
      prevPetalsRef.current = petalsProgress;
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
    prevPetalsRef.current = petalsProgress;
  }, [petalsProgress]);

  return (
    <Link
      href="/belonninger/hage"
      className="relative flex items-center justify-center flex-shrink-0"
      title="Min blomsterhage"
    >
      <motion.div
        animate={
          teaserBounce
            ? {
                scale: [1, 1.25, 0.9, 1.1, 1],
                rotate: [0, -6, 6, -3, 0],
              }
            : { scale: 1 }
        }
        transition={
          teaserBounce ? { duration: 0.55, ease: "easeOut" } : { duration: 0.2 }
        }
        className="relative"
      >
        <FlowerPot
          petalsFilled={teaserFilled}
          colors={teaserColors}
          size={44}
          isInteractive={false}
        />
        {/* Subtle petal count dots */}
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-[2px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-[5px] h-[5px] rounded-full transition-colors duration-300 ${
                i < teaserFilled
                  ? "bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.6)]"
                  : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </motion.div>
    </Link>
  );
}
