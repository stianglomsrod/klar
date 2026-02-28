"use client";

import { useState, useCallback, useEffect } from "react";
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
  isBloomAnimating?: boolean;
  onBloomComplete?: () => void;
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
  isBloomAnimating = false,
  onBloomComplete,
}: FlowerPotProps) {
  const center = size / 2;
  const flowerCenter = center - size * 0.05; // Position flower higher
  const petalLength = size * 0.26;
  const petalWidth = size * 0.22;
  // Track which petals are "freshly painted" (fill-splash animation)
  const [splashingPetals, setSplashingPetals] = useState<Set<number>>(
    new Set(),
  );
  // Track which painted petals were tapped (shake feedback)
  const [shakingPetals, setShakingPetals] = useState<Set<number>>(new Set());

  // Bloom animation stage: 0=idle, 1=petals burst out, 2=glow center, 3=shrink+float
  const [bloomStage, setBloomStage] = useState(0);

  useEffect(() => {
    if (!isBloomAnimating) {
      setBloomStage(0);
      return;
    }
    // Stage 1: petals pulse outward (0ms)
    setBloomStage(1);
    // Stage 2: glowing center burst (800ms)
    const t2 = setTimeout(() => setBloomStage(2), 800);
    // Stage 3: shrink + float upward (1800ms)
    const t3 = setTimeout(() => setBloomStage(3), 1800);
    // Complete callback (3200ms)
    const t4 = setTimeout(() => {
      onBloomComplete?.();
    }, 3200);
    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isBloomAnimating, onBloomComplete]);

  // Generate petal positions (5 fixed petals evenly distributed around center)
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 5;
    return { angle: (angle * 180) / Math.PI, index: i };
  });

  // Handle petal click with splash or shake feedback
  const handlePetalInteraction = useCallback(
    (index: number, hasExplicitColor: boolean) => {
      if (isAnimatingSuccess) return;

      if (!hasExplicitColor && hasPaint && onPetalClick) {
        // Paint this petal — trigger fill-splash
        setSplashingPetals((prev) => new Set(prev).add(index));
        onPetalClick(index);
        setTimeout(() => {
          setSplashingPetals((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 800);
      } else if (hasExplicitColor && hasPaint && isInteractive) {
        // Already painted — shake feedback
        setShakingPetals((prev) => new Set(prev).add(index));
        setTimeout(() => {
          setShakingPetals((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 500);
      }
    },
    [isAnimatingSuccess, hasPaint, isInteractive, onPetalClick],
  );

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

  // Slightly enlarged teardrop for hit detection (12% larger = generous activation zone)
  const createHitAreaPetal = () => {
    const s = 1.12;
    const l = petalLength * s;
    const w = petalWidth * s;
    return `M 0,0 
            C ${w * 0.25},${l * 0.2} ${w * 0.65},${l * 0.55} ${w * 0.35},${l * 0.9}
            Q ${w * 0.1},${l} 0,${l} 
            Q ${-w * 0.1},${l} ${-w * 0.35},${l * 0.9}
            C ${-w * 0.65},${l * 0.55} ${-w * 0.25},${l * 0.2} 0,0 Z`;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${
        isInteractive ? "cursor-none [&_*]:cursor-none" : "cursor-default"
      }`}
    >
      <motion.div
        animate={
          bloomStage === 3
            ? { scale: [1, 0.6], y: [0, -60], opacity: [1, 0] }
            : isAnimatingSuccess
              ? { scale: [1, 1.08, 1] }
              : {}
        }
        transition={
          bloomStage === 3
            ? { duration: 1.2, ease: "easeInOut" }
            : isAnimatingSuccess
              ? { duration: 0.6, repeat: 2, ease: "easeInOut" }
              : {}
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            cursor: isInteractive ? "none" : "default",
            pointerEvents: "auto",
          }}
        >
          {/* Glow filter for freshly painted petals */}
          <defs>
            <filter
              id="petal-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id="bloom-glow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

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
                explicitColor.trim().length > 0 &&
                explicitColor.trim() !== "#E0E0E0",
              );
              const petalColor = hasExplicitColor ? explicitColor : "#E5E7EB";
              const isPaintable =
                isInteractive && hasPaint && !hasExplicitColor;
              const isHovered = hoveredPetalIndex === petal.index;
              const isSplashing = splashingPetals.has(petal.index);
              const isShaking = shakingPetals.has(petal.index);

              // Determine the animated state for this petal
              const getAnimateState = () => {
                // Bloom animation — petals burst outward
                if (bloomStage >= 1 && bloomStage <= 2) {
                  return {
                    scale: [1, 1.3, 1.15],
                    opacity: 1,
                    filter: "drop-shadow(0px 0px 10px rgba(255, 215, 0, 0.7))",
                  };
                }
                if (bloomStage === 3) {
                  return {
                    scale: 1.15,
                    opacity: 1,
                    filter: "drop-shadow(0px 0px 10px rgba(255, 215, 0, 0.7))",
                  };
                }
                // Freshly painted splash
                if (isSplashing) {
                  return {
                    scale: [0.85, 1.25, 1],
                    opacity: 1,
                    filter: "drop-shadow(0px 0px 12px rgba(255, 215, 0, 0.8))",
                  };
                }
                // Shake (tapped already-painted petal)
                if (isShaking) {
                  return {
                    scale: 1,
                    rotate: [0, -8, 8, -5, 5, 0],
                    opacity: 1,
                    filter: "none",
                  };
                }
                // Hover while paintable
                if (isHovered && isPaintable && !isAnimatingSuccess) {
                  return {
                    scale: 1.15,
                    opacity: 1,
                    filter: "drop-shadow(0px 0px 16px rgba(255, 255, 255, 1))",
                  };
                }
                // Unpainted petal breathing pulse (inviting interaction)
                if (isPaintable && !isAnimatingSuccess) {
                  return {
                    scale: 1,
                    opacity: [0.35, 0.55, 0.35],
                    filter: "none",
                  };
                }
                // Default state
                return {
                  scale: 1,
                  opacity: hasExplicitColor ? 1 : 0.4,
                  filter: "none",
                };
              };

              const getTransition = () => {
                if (bloomStage >= 1) {
                  return {
                    duration: 0.7,
                    ease: "easeOut" as const,
                    delay: petal.index * 0.08,
                  };
                }
                if (isSplashing) {
                  return { duration: 0.6, ease: "easeOut" as const };
                }
                if (isShaking) {
                  return { duration: 0.4, ease: "easeInOut" as const };
                }
                if (isPaintable && !isHovered && !isAnimatingSuccess) {
                  return {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut" as const,
                  };
                }
                return { duration: 0.2 };
              };

              return (
                <g
                  key={`petal-${petal.index}`}
                  transform={`translate(${center}, ${flowerCenter}) rotate(${petal.angle})`}
                  onMouseEnter={() => {
                    if (isPaintable && setHoveredPetalIndex) {
                      setHoveredPetalIndex(petal.index);
                    }
                  }}
                  onMouseLeave={() => {
                    if (setHoveredPetalIndex) {
                      setHoveredPetalIndex(null);
                    }
                  }}
                  onTouchStart={() => {
                    if (isInteractive && setHoveredPetalIndex) {
                      setHoveredPetalIndex(petal.index);
                    }
                  }}
                  onTouchEnd={() => {
                    if (isInteractive) {
                      handlePetalInteraction(petal.index, hasExplicitColor);
                    }
                    if (setHoveredPetalIndex) {
                      setHoveredPetalIndex(null);
                    }
                  }}
                  style={{
                    pointerEvents: isAnimatingSuccess ? "none" : "auto",
                    cursor: isInteractive ? "none" : "default",
                  }}
                >
                  {/* Shape-matching hit area (12% larger teardrop) */}
                  <path
                    d={createHitAreaPetal()}
                    fill="transparent"
                    stroke="none"
                    style={{
                      pointerEvents:
                        isInteractive && hasPaint ? "fill" : "none",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isInteractive && hasPaint) {
                        handlePetalInteraction(petal.index, hasExplicitColor);
                      }
                    }}
                  />
                  {/* Main petal */}
                  <motion.path
                    d={createTeardropPetal()}
                    fill={petalColor}
                    stroke={hasExplicitColor ? "none" : "#9CA3AF"}
                    strokeWidth={hasExplicitColor ? 0 : 1.5}
                    strokeDasharray={hasExplicitColor ? "none" : "5,4"}
                    animate={getAnimateState()}
                    transition={getTransition()}
                    filter={isSplashing ? "url(#petal-glow)" : undefined}
                    style={{
                      pointerEvents: "none",
                      cursor: "none",
                    }}
                    className="[transform-box:fill-box] [transform-origin:center]"
                  />
                  {/* Sparkle dots on freshly painted petal */}
                  {isSplashing && (
                    <>
                      <motion.circle
                        cx={petalWidth * 0.15}
                        cy={petalLength * 0.3}
                        r={size * 0.012}
                        fill="white"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                      />
                      <motion.circle
                        cx={-petalWidth * 0.1}
                        cy={petalLength * 0.6}
                        r={size * 0.01}
                        fill="white"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                      />
                      <motion.circle
                        cx={petalWidth * 0.05}
                        cy={petalLength * 0.8}
                        r={size * 0.008}
                        fill="white"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                      />
                    </>
                  )}
                </g>
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
            animate={
              bloomStage >= 2
                ? { scale: [1, 1.6, 1.3], opacity: [1, 1, 0.9] }
                : { scale: 1 }
            }
            transition={
              bloomStage >= 2
                ? { duration: 0.8, ease: "easeOut" }
                : { delay: 0.5, duration: 0.4 }
            }
            filter={bloomStage >= 2 ? "url(#bloom-glow)" : undefined}
          />
        </svg>
      </motion.div>
    </div>
  );
}
