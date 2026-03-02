"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import type { ToastState } from "@/hooks/useToast";

const VARIANT_STYLES = {
  success: {
    bg: "bg-slate-900",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
  },
  error: {
    bg: "bg-red-600",
    icon: AlertCircle,
    iconColor: "text-red-200",
  },
  warning: {
    bg: "bg-amber-600",
    icon: AlertTriangle,
    iconColor: "text-amber-200",
  },
  info: {
    bg: "bg-blue-600",
    icon: Info,
    iconColor: "text-blue-200",
  },
} as const;

type ToastProps = {
  toast: ToastState;
  onClose: () => void;
};

/**
 * Non-blocking toast notification.
 * Place once at the bottom of the page component's JSX:
 *
 *   <Toast toast={toast} onClose={hideToast} />
 */
export default function Toast({ toast, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-live="polite"
          className={`fixed top-6 right-6 z-50 max-w-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 ${VARIANT_STYLES[toast.variant].bg} text-white`}
        >
          {(() => {
            const Icon = VARIANT_STYLES[toast.variant].icon;
            return (
              <Icon
                className={`h-5 w-5 shrink-0 ${VARIANT_STYLES[toast.variant].iconColor}`}
              />
            );
          })()}
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={onClose}
            className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
