"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Hand, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";

type StudentHelpButtonProps = {
  studentId: string;
  classId: string;
};

type HelpRequest = {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
  created_at: string;
};

export default function StudentHelpButton({
  studentId,
  classId,
}: StudentHelpButtonProps) {
  const [isTeacherAvailable, setIsTeacherAvailable] = useState(false);
  const [myRequest, setMyRequest] = useState<HelpRequest | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCancelPopover, setShowCancelPopover] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const [popoverPosition, setPopoverPosition] = useState({
    bottom: 96,
    right: 32,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const supabase = createClient();

  // Subscribe to teacher availability changes
  useEffect(() => {
    // Initial check
    const checkAvailability = async () => {
      try {
        const { data, error } = await supabase
          .from("teacher_active_sessions")
          .select("id")
          .eq("class_id", classId)
          .limit(1);

        if (error) throw error;
        const available = (data || []).length > 0;
        setIsTeacherAvailable(available);
      } catch {
        // Silent – defaults to unavailable
      }
    };

    checkAvailability();

    // Listen to ALL changes without filter (DELETE events don't work well with filters)
    const channel = supabase
      .channel(`teacher_availability:${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_active_sessions",
        },
        () => {
          // Since DELETE events don't include class_id in payload.old,
          // we just refresh on any change and let the query filter by class_id
          checkAvailability();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, supabase]);

  // Subscribe to help queue changes
  useEffect(() => {
    // Initial fetch
    const fetchRequest = async () => {
      try {
        const { data: myData, error: myError } = await supabase
          .from("help_requests")
          .select("*")
          .eq("student_id", studentId)
          .eq("class_id", classId)
          .eq("status", "pending")
          .maybeSingle();

        if (myError) {
          return;
        }

        if (myData) {
          setMyRequest(myData);

          const { count, error: beforeError } = await supabase
            .from("help_requests")
            .select("id", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("status", "pending")
            .lt("created_at", myData.created_at);

          if (beforeError) {
            return;
          }

          const position = (count || 0) + 1;
          setQueuePosition(position);
        } else {
          setMyRequest(null);
          setQueuePosition(0);
        }
      } catch {
        // Silent – realtime subscription retries
      }
    };

    fetchRequest();

    const channel = supabase
      .channel(`help_queue:${classId}:${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_requests",
          filter: `class_id=eq.${classId}`,
        },
        () => {
          fetchRequest();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, studentId, supabase]);

  // Request help
  const handleRequestHelp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("help_requests").insert({
        student_id: studentId,
        class_id: classId,
        status: "pending",
      });

      if (error) throw error;
      // Real-time subscription will handle updating the UI
    } catch {
      showToast("Kunne ikke be om hjelp. Prøv igjen.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Cancel help request
  const handleCancelHelp = async () => {
    if (!myRequest) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("help_requests")
        .update({ status: "cancelled" })
        .eq("id", myRequest.id);

      if (error) throw error;
      setMyRequest(null);
      setQueuePosition(0);
      setShowCancelPopover(false);
    } catch {
      showToast("Kunne ikke avbryte. Prøv igjen.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Calculate popover position based on button position
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        // Position popover above button
        const distanceFromBottom = windowHeight - buttonRect.top + 16;
        const distanceFromRight =
          windowWidth - (buttonRect.left + buttonRect.width / 2);

        setPopoverPosition({
          bottom: distanceFromBottom,
          right: distanceFromRight,
        });
      }
    };

    if (showCancelPopover) {
      setTimeout(updatePosition, 10);
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [showCancelPopover]);

  // Click outside to close popover
  useEffect(() => {
    if (!showCancelPopover) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close if clicking outside button and popover
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        !target.closest(".popover-content")
      ) {
        setShowCancelPopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCancelPopover]);

  // Note: The button is always shown when this component is rendered
  // (parent already checks isQueueOpen). Teacher availability only affects
  // whether the student can submit a new request.

  return (
    <>
      {!myRequest ? (
        // State A: Ask for help - Circle widget matching timer
        <button
          ref={buttonRef}
          onClick={handleRequestHelp}
          disabled={loading}
          className="relative group flex items-center justify-center h-14 w-14 rounded-full border border-gray-100 bg-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-gray-50 active:scale-95 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Be læreren om hjelp"
        >
          <Hand
            className="h-6 w-6 transition-transform duration-300"
            strokeWidth={2}
          />
        </button>
      ) : (
        // State B: In queue - Expanded widget with queue info
        <>
          <button
            ref={buttonRef}
            onClick={() => setShowCancelPopover((prev) => !prev)}
            disabled={loading}
            className="relative group flex items-center justify-center gap-2 h-14 w-auto px-6 rounded-full border border-gray-100 bg-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-gray-50 active:scale-95 ring-2 ring-orange-400 text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Jeg venter p\u00e5 hjelp. Klikk for \u00e5 avbryte"
          >
            <Users
              className="h-6 w-6 transition-transform duration-300"
              strokeWidth={2}
            />
            <span className="font-semibold text-sm">Nr {queuePosition}</span>
          </button>

          {/* Cancel Popover */}
          <AnimatePresence>
            {showCancelPopover && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed z-50"
                style={{
                  bottom: `${popoverPosition.bottom + 8}px`,
                  right: `${popoverPosition.right - 60}px`,
                }}
              >
                {/* Popover Card */}
                <div className="popover-content bg-white rounded-2xl shadow-2xl p-4 border border-gray-100 relative">
                  {/* Tail/Arrow pointing to button */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-r border-b border-gray-100 transform rotate-45"></div>

                  <div className="relative z-10 flex flex-col items-center justify-center">
                    {/* Clickable X Icon */}
                    <button
                      onClick={handleCancelHelp}
                      disabled={loading}
                      className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 hover:bg-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                      title="Forlat køen"
                    >
                      <X className="h-6 w-6 text-red-600" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      <Toast toast={toast} onClose={hideToast} />
    </>
  );
}
