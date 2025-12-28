"use client";

import { motion } from "framer-motion";

type FlowerPotProps = {
  petalsFilled?: number;
  colors?: string[];
  size?: number;
  onPetalClick?: (index: number) => void;
  isInteractive?: boolean;
  hasPaint?: boolean;
  hoveredPetalIndex?: number | null;
  setHoveredPetalIndex?: (index: number | null) => void;
  isAnimatingSuccess?: boolean;
};

export default function FlowerPot({
  petalsFilled = 0,
  colors = ["#FF69B4", "#FFA500", "#FFD700", "#FF6B6B", "#4ECDC4"],
  size = 200,
  onPetalClick,
  isInteractive = false,
  hasPaint = false,
  hoveredPetalIndex = null,
  setHoveredPetalIndex,
  isAnimatingSuccess = false,
}: FlowerPotProps) {
  const center = size / 2;
  const flowerCenter = center - size * 0.05; // Position flower higher
  const petalLength = size * 0.26;
  const petalWidth = size * 0.22;
  // Generate petal positions (5 fixed petals evenly distributed around center)
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
      <motion.div
        animate={isAnimatingSuccess ? { scale: [1, 1.08, 1] } : {}}
        transition={
          isAnimatingSuccess
            ? { duration: 0.6, repeat: 2, ease: "easeInOut" }
            : {}
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ cursor: "none", pointerEvents: "auto" }}
        >
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
              const explicitColor = colors[petal.index];
              const hasExplicitColor = Boolean(
                explicitColor &&
                  explicitColor.trim &&
                  explicitColor.trim().length > 0
              );
              const petalColor = hasExplicitColor ? explicitColor : "#E5E7EB";
              const isPaintable =
                isInteractive && hasPaint && !hasExplicitColor;
              const isHovered = hoveredPetalIndex === petal.index;

              return (
                <motion.g
                  key={`petal-${petal.index}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: petal.index * 0.1,
                    duration: 0.4,
                  }}
                  style={{
                    pointerEvents: isAnimatingSuccess ? "none" : "auto",
                    cursor: "none",
                  }}
                  // Base placement: translate to flower center and rotate to petal angle
                  transform={`translate(${center}, ${flowerCenter}) rotate(${petal.angle})`}
                >
                  {/* Main petal */}
                  <motion.path
                    d={createTeardropPetal()}
                    fill={petalColor}
                    stroke={hasExplicitColor ? "none" : "#9CA3AF"}
                    strokeWidth={hasExplicitColor ? 0 : 2}
                    strokeDasharray={hasExplicitColor ? "none" : "5,3"}
                    opacity={hasExplicitColor ? 1 : 0.6}
                    onClick={() => {
                      if (hasPaint && isPaintable && onPetalClick) {
                        onPetalClick(petal.index);
                      }
                    }}
                    onMouseEnter={() => {
                      if (isPaintable && setHoveredPetalIndex) {
                        setHoveredPetalIndex(petal.index);
                      }
                    }}
                    onMouseLeave={() => {
                      if (isPaintable && setHoveredPetalIndex) {
                        setHoveredPetalIndex(null);
                      }
                    }}
                    onTouchStart={() => {
                      if (isPaintable && setHoveredPetalIndex) {
                        setHoveredPetalIndex(petal.index);
                      }
                    }}
                    onTouchEnd={() => {
                      if (hasPaint && isPaintable && onPetalClick) {
                        onPetalClick(petal.index);
                      }
                      if (isPaintable && setHoveredPetalIndex) {
                        setHoveredPetalIndex(null);
                      }
                    }}
                    whileHover={
                      isPaintable && !isAnimatingSuccess
                        ? {
                            scale: 1.1,
                            filter:
                              "drop-shadow(0px 0px 12px rgba(255, 255, 255, 0.95))",
                            transition: { duration: 0.15 },
                          }
                        : {}
                    }
                    animate={{ scale: 1, filter: "none" }}
                    style={{
                      pointerEvents: isAnimatingSuccess ? "none" : "auto",
                    }}
                    className="[transform-box:fill-box] [transform-origin:center]"
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
      </motion.div>
    </div>
  );
}
