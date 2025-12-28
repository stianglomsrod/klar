"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

type NavigationProps = {
  level?: number;
  progressPercent?: number;
  avatar?: string;
};

export default function Navigation({
  level = 3,
  progressPercent = 42,
  avatar = "🦄",
}: NavigationProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        level={level}
        progressPercent={progressPercent}
        avatar={avatar}
      />
      {/* Hamburger Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-800 transition-colors"
        aria-label="Åpne meny"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </>
  );
}
