"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type PaintBrushCursorProps = {
  color: string | null;
};

export default function PaintBrushCursor({ color }: PaintBrushCursorProps) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showDrip, setShowDrip] = useState(false);
  const prevColorRef = useRef<string | null>(null);

  // Detect touch-primary devices
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setIsTouchDevice(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Mouse tracking (desktop)
  useEffect(() => {
    if (isTouchDevice) return;
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [isTouchDevice]);

  // Touch tracking (mobile/tablet) — show splat indicator at touch point
  useEffect(() => {
    if (!isTouchDevice) return;
    const handleTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        setPos({ x: touch.clientX, y: touch.clientY });
      }
    };
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });
    return () => {
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchstart", handleTouch);
    };
  }, [isTouchDevice]);

  // Drip animation when color first dipped
  useEffect(() => {
    if (color && !prevColorRef.current) {
      setShowDrip(true);
      const timer = setTimeout(() => setShowDrip(false), 700);
      return () => clearTimeout(timer);
    }
    prevColorRef.current = color;
  }, [color]);

  // Touch device: show a simple colored splat indicator
  if (isTouchDevice) {
    if (!color) return null;
    return (
      <div
        className="pointer-events-none fixed z-[9999]"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, opacity: [0.9, 0.6, 0.9] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color} 40%, transparent 70%)`,
            boxShadow: `0 0 16px ${color}88`,
          }}
        />
      </div>
    );
  }

  // Desktop: full paintbrush cursor
  return (
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translate(-18px, -18px) rotate(155deg)",
        transformOrigin: "0 0",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Bristles/Tip (paint part) - positioned at top */}
        <ellipse
          cx="24"
          cy="7"
          rx="9.5"
          ry="12"
          fill={color ?? "#E8E8E8"}
          stroke={color ? "none" : "#999999"}
          strokeWidth="0.5"
        />

        {/* Bristle texture lines for depth */}
        {color && (
          <>
            <line
              x1="17"
              y1="9"
              x2="17"
              y2="16"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="0.8"
            />
            <line
              x1="24"
              y1="7"
              x2="24"
              y2="18"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="0.8"
            />
            <line
              x1="31"
              y1="9"
              x2="31"
              y2="16"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="0.8"
            />
          </>
        )}

        {/* Ferrule (metal part connecting bristles to handle) */}
        <rect
          x="17"
          y="17"
          width="14"
          height="5"
          rx="2"
          fill="#C0C0C0"
          stroke="#808080"
          strokeWidth="0.8"
        />

        {/* Handle (wooden part) */}
        <path
          d="M 19 22 Q 18 28 19 36 L 29 36 Q 30 28 29 22 Z"
          fill="#A0826D"
          stroke="#7A5C48"
          strokeWidth="1"
        />

        {/* Handle highlight for dimension */}
        <ellipse cx="21" cy="28" rx="1.8" ry="5" fill="#D4AF9A" opacity="0.6" />

        {/* End cap */}
        <circle
          cx="24"
          cy="37"
          r="3"
          fill="#8B6F47"
          stroke="#6B5437"
          strokeWidth="0.8"
        />
      </svg>

      {/* Drip animation when color first picked */}
      <AnimatePresence>
        {showDrip && color && (
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: 22, scale: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeIn" }}
            style={{
              position: "absolute",
              top: 6,
              left: 20,
              width: 8,
              height: 10,
              borderRadius: "50% 50% 50% 50% / 30% 30% 70% 70%",
              background: color,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
