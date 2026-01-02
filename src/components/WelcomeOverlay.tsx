"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

type WelcomeOverlayProps = {
  initialVisible?: boolean;
  onDismiss?: () => void;
};

export default function WelcomeOverlay({
  initialVisible = true,
  onDismiss,
}: WelcomeOverlayProps) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const { profile } = useStudentProfile();

  // Når man klikker, fader vi ut skjermen
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  // Determine welcome message
  const welcomeMessage =
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
