"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker for push notifications.
 * Renders nothing — purely a side-effect component.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Silent — SW registration failure is non-critical */
      });
    }
  }, []);

  return null;
}
