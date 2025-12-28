"use client";

import { motion } from "framer-motion";

type FlowerPotProps = {
  petalsFilled?: number;
  colors?: string[];
  size?: number;
  onPetalClick?: () => void;
  isInteractive?: boolean;
  hasPaint?: boolean;
};

export default function FlowerPot({
  petalsFilled = 0,
  colors = ["#FF69B4", "#FFA500", "#FFD700", "#FF6B6B", "#4ECDC4"],
  size = 200,
  onPetalClick,
  isInteractive = false,
  hasPaint = false,
}: FlowerPotProps) {
  const center = size / 2;
  const flowerCenter = center - size * 0.05; // Position flower higher
  const petalLength = size * 0.26;
  const petalWidth = size * 0.22;
  const nextPetalIndex = petalsFilled; // Index of the next empty petal to fill

  // Generate petal positions (5 petals evenly distributed around center)
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 5;
    return { angle: (angle * 180) / Math.PI, index: i };
  });

  // Create a teardrop petal: narrow at base (0,0), grows wider, widest point at ~70%, round tip
  const createTeardropPetal = () => {
    const l = petalLength;
    const w = petalWidth;
    // Start narrow, widen significantly in the middle, round at top
    return `M 0,0 
            C ${w * 0.25},${l * 0.2} ${w * 0.65},${l * 0.55} ${w * 0.35},${
      l * 0.9
    }
            Q ${w * 0.1},${l} 0,${l} 
            Q ${-w * 0.1},${l} ${-w * 0.35},${l * 0.9}
            C ${-w * 0.65},${l * 0.55} ${-w * 0.25},${l * 0.2} 0,0 Z`;
  };

  return (
    <div className="flex flex-col items-center justify-center cursor-none [&_*]:cursor-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ cursor: 'none' }}>
        {/* Layer 1: Stem (background) */}
        <line
          x1={center}
          y1={center + size * 0.24}
          x2={center}
          y2={flowerCenter}
          stroke="#5A9367"
          strokeWidth={size * 0.025}
          strokeLinecap="round"
        />

        {/* Layer 2: Pot Body (trapezoid) */}
        <path
          d={`M ${center - size * 0.16} ${center + size * 0.24}
              L ${center - size * 0.13} ${center + size * 0.42}
              L ${center + size * 0.13} ${center + size * 0.42}
              L ${center + size * 0.16} ${center + size * 0.24} Z`}
          fill="#CD7F32"
          stroke="#8B5A2B"
          strokeWidth="1.5"
        />

        {/* Layer 3: Pot Rim (3D effect) */}
        <ellipse
          cx={center}
          cy={center + size * 0.24}
          rx={size * 0.17}
          ry={size * 0.03}
          fill="#D2691E"
          stroke="#8B4513"
          strokeWidth="1.5"
        />

        {/* Layer 4: Soil */}
        <ellipse
          cx={center}
          cy={center + size * 0.26}
          rx={size * 0.13}
          ry={size * 0.025}
          fill="#6B5842"
        />

        {/* Layer 5: Petals (behind center) - with 36° rotation */}
        <g transform={`rotate(36, ${center}, ${flowerCenter})`}>
          {petals.map((petal) => {
            const isFilled = petal.index < petalsFilled;
            const petalColor = isFilled ? colors[petal.index] : "#E5E7EB";
            const isNextPetal = petal.index === nextPetalIndex;
            const isClickable = isInteractive && isNextPetal && hasPaint;

            return (
              <motion.g
                key={`petal-${petal.index}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: petal.index * 0.1,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 100,
                }}
                style={{
                  pointerEvents: isClickable ? 'auto' : 'none',
                  cursor: 'none',
                }}
              >
                {/* Interactive glow for next petal */}
                {isNextPetal && isInteractive && hasPaint && (
                  <motion.path
                    d={createTeardropPetal()}
                    fill="none"
                    stroke={colors[nextPetalIndex] || "#FFD700"}
                    strokeWidth={size * 0.015}
                    opacity={0.3}
                    transform={`translate(${center}, ${flowerCenter}) rotate(${petal.angle})`}
                    animate={{ opacity: [0.2, 0.6, 0.2] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}

                {/* Main petal */}
                <motion.path
                  d={createTeardropPetal()}
                  fill={petalColor}
                  stroke={
                    isNextPetal && isInteractive && hasPaint
                      ? colors[nextPetalIndex]
                      : isFilled
                        ? "none"
                        : "#9CA3AF"
                  }
                  strokeWidth={
                    isNextPetal && isInteractive && hasPaint
                      ? size * 0.02
                      : isFilled
                        ? 0
                        : 2
                  }
                  strokeDasharray={isFilled ? "none" : "5,3"}
                  opacity={isFilled ? 1 : 0.5}
                  transform={`translate(${center}, ${flowerCenter}) rotate(${petal.angle})`}
                  onClick={() => {
                    if (isClickable && onPetalClick) {
                      onPetalClick();
                    }
                  }}
                  whileHover={
                    isClickable
                      ? { filter: "drop-shadow(0px 0px 8px rgba(255, 255, 255, 0.8))" }
                      : {}
                  }
                />
              </motion.g>
            );
          })}
        </g>

        {/* Layer 6: Center Circle (on top, covers petal bases) */}
        <motion.circle
          cx={center}
          cy={flowerCenter}
          r={size * 0.09}
          fill="#FFD700"
          stroke="#FFA500"
          strokeWidth="1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        />
      </svg>
    </div>
  );
}
