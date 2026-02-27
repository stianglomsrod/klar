"use client";

import { useState, useCallback, useRef } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastState = {
  message: string;
  variant: ToastVariant;
} | null;

/**
 * Lightweight toast hook.
 *
 * Usage:
 *   const { toast, showToast, hideToast } = useToast();
 *   showToast("Lagret!");                    // success (default)
 *   showToast("Noe gikk galt", "error");    // error
 *
 * Render:
 *   <Toast toast={toast} onClose={hideToast} />
 */
export function useToast(defaultDuration = 4000) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    setToast(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success", duration?: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, variant });
      const ms = duration ?? defaultDuration;
      if (ms > 0) {
        timerRef.current = setTimeout(() => {
          setToast(null);
          timerRef.current = null;
        }, ms);
      }
    },
    [defaultDuration],
  );

  return { toast, showToast, hideToast } as const;
}
