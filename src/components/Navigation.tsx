"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import FeedbackSheet from "./student/FeedbackSheet";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { createClient } from "@/utils/supabase/client";

export default function Navigation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const { profile, refresh } = useStudentProfile();

  // Expose refresh via window for subject page to call
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__refreshStudentProfile = refresh;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__refreshStudentProfile;
      }
    };
  }, [refresh]);

  const isRootPage = pathname === "/" || pathname === "/student";

  // Fetch unread feedback count for the global badge
  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnreadCount = async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("student_id", profile.id)
        .is("read_at", null)
        .or("teacher_reaction.not.is.null,teacher_comment.not.is.null");

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    fetchUnreadCount();

    // Re-check every 30s while mounted
    const interval = setInterval(fetchUnreadCount, 30000);

    // Instant refresh when a subject page marks feedback as read
    const handleFeedbackRead = () => fetchUnreadCount();
    window.addEventListener("feedback-read", handleFeedbackRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener("feedback-read", handleFeedbackRead);
    };
  }, [profile?.id, pathname]); // re-fetch when navigating between pages

  // Use current_xp for progress bar (per-level accumulator)
  const userLevel = profile?.level ?? 1;
  const currentGoal = profile?.current_goal_total ?? 1000;
  const currentXp = profile?.current_xp ?? 0;
  const progressPercent = (currentXp / currentGoal) * 100;
  const userAvatar = profile?.avatar_url || "🦄";

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        level={userLevel}
        progressPercent={progressPercent}
        avatar={userAvatar}
      />

      {/* Native Header / Top App Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="flex items-center h-full px-4">
          {/* Left Slot: Hamburger (root) or Back Button (sub-pages) */}
          <div className="flex-shrink-0">
            {isRootPage ? (
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
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

          {/* Right Slot: Feedback button (always visible) */}
          <div className="flex-shrink-0 w-10 flex items-center justify-center">
            <div
              className="relative flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 cursor-pointer hover:bg-indigo-100 transition-colors"
              onClick={() => setFeedbackSheetOpen(true)}
              title="Tilbakemeldinger"
            >
              <span className="text-base">💬</span>
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    exit={{ scale: 0 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white shadow-sm px-1"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Feedback "Wall of Praise" sheet */}
      {profile?.id && (
        <FeedbackSheet
          isOpen={feedbackSheetOpen}
          onClose={() => setFeedbackSheetOpen(false)}
          studentId={profile.id}
        />
      )}
    </>
  );
}
