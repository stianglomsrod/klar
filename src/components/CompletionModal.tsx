"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { Send, Loader2 } from "lucide-react";
import { isImageUrl } from "@/utils/avatar";

type CompletionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Async callback run before onConfirm (e.g. to stop active recordings).
   *  If provided, the modal shows a spinner while it resolves. */
  onBeforeConfirm?: () => Promise<void>;
  /** Student avatar URL from StudentProfileContext */
  avatarUrl?: string | null;
  /** Optional warning message (e.g. "Du har 2 ubesvarte spørsmål") shown in amber */
  warningMessage?: string;
  /** Optional slot rendered between the text and the submit button (for media toolbar) */
  children?: ReactNode;
};

export default function CompletionModal({
  isOpen,
  onClose,
  onConfirm,
  onBeforeConfirm,
  avatarUrl,
  warningMessage,
  children,
}: CompletionModalProps) {
  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleConfirm = async () => {
    if (onBeforeConfirm) {
      setIsFinalizing(true);
      try {
        await onBeforeConfirm();
      } finally {
        setIsFinalizing(false);
      }
    }
    // Sound is played by the parent (page.tsx) after the completion logic succeeds
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

          {/* Centered Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full px-8 py-10 text-center pointer-events-auto">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="mb-6"
              >
                {isImageUrl(avatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Din avatar"
                    className="w-16 h-16 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <div className="text-6xl">{avatarUrl || "🦄"}</div>
                )}
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Er du sikker på at du er ferdig?
              </h2>

              {/* Dynamic warning for unanswered questions */}
              {warningMessage && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                  <p className="text-sm text-amber-800 font-medium">
                    ⚠️ {warningMessage}
                  </p>
                </div>
              )}

              {/* Optional media toolbar slot */}
              {children && (
                <div className="mb-6 flex justify-center">{children}</div>
              )}

              <div className="flex flex-col gap-3 mt-2">
                <button
                  onClick={handleConfirm}
                  disabled={isFinalizing}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-emerald-400 disabled:to-green-500 text-white font-black text-lg py-5 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 uppercase tracking-wide active:scale-[0.98]"
                >
                  {isFinalizing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Lagrer...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Fullfør
                    </>
                  )}
                </button>

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
