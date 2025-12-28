"use client";

import { useEffect, useState } from "react";

type PaintBrushCursorProps = {
  color: string | null;
};

export default function PaintBrushCursor({ color }: PaintBrushCursorProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        // Place the bristle tip right at the mouse coordinates
        // Negative offsets bring the tip forward to match the pointer
        transform: "translate(-16px, -16px) rotate(155deg)",
        transformOrigin: "0 0",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Bristles/Tip (paint part) - positioned at top */}
        <ellipse
          cx="20"
          cy="6"
          rx="8"
          ry="10"
          fill={color ?? "#E8E8E8"}
          stroke={color ? "none" : "#999999"}
          strokeWidth="0.5"
        />

        {/* Bristle texture lines for depth */}
        {color && (
          <>
            <line x1="14" y1="8" x2="14" y2="14" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" />
            <line x1="20" y1="6" x2="20" y2="15" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" />
            <line x1="26" y1="8" x2="26" y2="14" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" />
          </>
        )}

        {/* Ferrule (metal part connecting bristles to handle) */}
        <rect
          x="14"
          y="14"
          width="12"
          height="4"
          rx="2"
          fill="#C0C0C0"
          stroke="#808080"
          strokeWidth="0.8"
        />

        {/* Handle (wooden part) */}
        <path
          d="M 16 18 Q 15 24 16 30 L 24 30 Q 25 24 24 18 Z"
          fill="#A0826D"
          stroke="#7A5C48"
          strokeWidth="1"
        />

        {/* Handle highlight for dimension */}
        <ellipse
          cx="17.5"
          cy="23"
          rx="1.5"
          ry="4"
          fill="#D4AF9A"
          opacity="0.6"
        />

        {/* End cap */}
        <circle cx="20" cy="31" r="2.5" fill="#8B6F47" stroke="#6B5437" strokeWidth="0.8" />
      </svg>
    </div>
  );
}
