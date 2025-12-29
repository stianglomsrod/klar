"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();

  const isRootPage = pathname === "/";

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        level={level}
        progressPercent={progressPercent}
        avatar={avatar}
      />

      {/* Native Header / Top App Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="flex items-center h-full px-4">
          {/* Left Slot: Hamburger (root) or Back Button (sub-pages) */}
          <div className="flex-shrink-0">
            {isRootPage ? (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-800"
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
            ) : (
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-800"
                aria-label="Tilbake"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Center/Right Title - Home Button */}
          <button
            onClick={() => router.push("/")}
            className="flex-1 flex justify-center hover:opacity-70 transition-opacity"
          >
            <span className="text-sm font-medium text-gray-700">Klar</span>
          </button>

          {/* Right Slot: Empty for now (balance layout) */}
          <div className="flex-shrink-0 w-10"></div>
        </div>
      </header>
    </>
  );
}
