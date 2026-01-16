"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { createClient } from "@/utils/supabase/client";

type WelcomeOverlayProps = {
  initialVisible?: boolean;
  onDismiss?: () => void;
};

export default function WelcomeOverlay({
  initialVisible = true,
  onDismiss,
}: WelcomeOverlayProps) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [dailyAnnouncement, setDailyAnnouncement] = useState<string | null>(
    null
  );
  const { profile } = useStudentProfile();

  // Fetch daily announcement for this student
  useEffect(() => {
    const fetchAnnouncement = async () => {
      if (!profile?.id) return;

      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_student_daily_announcement",
        {
          p_student_id: profile.id,
        }
      );

      if (!error && data) {
        setDailyAnnouncement(data);
      }
    };

    fetchAnnouncement();
  }, [profile?.id]);

  // Når man klikker, fader vi ut skjermen
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  // Priority: Daily announcement > Custom welcome message > Default greeting
  const welcomeMessage =
    dailyAnnouncement ||
    profile?.custom_welcome_message ||
    (profile?.full_name ? `Hei, ${profile.full_name}!` : "Hei!");

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -50 }} // Sklir litt opp når den forsvinner
          transition={{ duration: 0.8, ease: "easeInOut" }}
          onClick={handleDismiss}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-blue-600 text-white cursor-pointer p-4 text-center"
        >
          <h1 className="text-4xl font-bold mb-4">{welcomeMessage} 👋</h1>
          <p className="text-xl opacity-90">
            Trykk hvor som helst for å starte dagen.
          </p>

          <div className="mt-8 animate-bounce">👇</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
