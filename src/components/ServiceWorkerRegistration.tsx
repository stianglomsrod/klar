"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker for push notifications.
 * Renders nothing — purely a side-effect component.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Remove a stale 2.x push worker when a browser is moved to the 3.0 pilot.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      void Promise.all(registrations.map((registration) => registration.unregister()));
    });
  }, []);

  return null;
}
