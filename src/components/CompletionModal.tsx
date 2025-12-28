"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

type CompletionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  avatar?: string;
};

export default function CompletionModal({
  isOpen,
  onClose,
  onConfirm,
  avatar = "🦄",
}: CompletionModalProps) {
  // Play success sound when confirmed
  const handleConfirm = () => {
    // Simple HTML5 Audio for success sound
    const audio = new Audio("/sounds/success.mp3"); // Placeholder URL
    audio.play().catch((e) => console.log("Audio play failed:", e));
    onConfirm();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto"
          >
            <div className="p-8 text-center">
              {/* Avatar */}
              <div className="text-6xl mb-4 animate-bounce">{avatar}</div>

              {/* Question */}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Er du sikker på at du vil levere?
              </h2>
              <p className="text-gray-600 mb-8">
                Du kan ikke angre på dette valget.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {/* Confirm Button - Large and Exciting */}
                <button
                  onClick={handleConfirm}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black text-lg py-5 px-6 rounded-2xl shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-200 uppercase tracking-wide animate-pulse hover:animate-none active:scale-[0.98]"
                >
                  JA, JEG ER FERDIG! 🎉
                </button>

                {/* Cancel Button - Subtle */}
                <button
                  onClick={onClose}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-xl transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
