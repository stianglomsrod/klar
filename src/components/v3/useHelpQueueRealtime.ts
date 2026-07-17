"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getHelpQueueReplicationState } from "@/lib/help-queue-realtime";
import { createClient } from "@/utils/supabase/client";

const MAX_TIMEOUT_MS = 2_147_000_000;
const HEARTBEAT_MS = 5 * 60_000;
const INITIAL_SYNC_RETRY_MS = 5_000;

export function useHelpQueueRealtime(
  classId: string | null,
  sessionEndsAt: string | null = null,
) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: number | null = null;
    let initialSyncTimer: number | null = null;
    const refresh = () => {
      if (disposed || refreshTimer !== null || !navigator.onLine) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (disposed || !navigator.onLine) return;
        router.refresh();
      }, 50);
    };
    const finishInitialSync = () => {
      if (initialSyncTimer !== null) {
        window.clearTimeout(initialSyncTimer);
        initialSyncTimer = null;
      }
      refresh();
    };
    const startSubscription = async () => {
      const { data } = await supabase.auth.getSession();
      if (disposed) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (disposed) return;
      const changeFilter = {
        event: "*" as const,
        schema: "public",
        table: "help_queue_signals",
        ...(classId ? { filter: `class_id=eq.${classId}` } : {}),
      };
      channel = supabase
        .channel(`help-queue-signal:${classId ?? "student"}`, {
          config: { broadcast: { replication_ready: true } },
        })
        .on("postgres_changes", changeFilter, finishInitialSync)
        .on("system", {}, (payload) => {
          const state = getHelpQueueReplicationState(
            payload.extension,
            payload.status,
          );
          if (state === "ready") {
            finishInitialSync();
          } else if (state === "error") {
            // Read once now, but keep the bounded fallback armed because
            // Postgres replication has not reported readiness.
            refresh();
          }
        })
        .subscribe((status) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            finishInitialSync();
          }
        });
    };
    void startSubscription().catch(finishInitialSync);
    initialSyncTimer = window.setTimeout(() => {
      initialSyncTimer = null;
      refresh();
    }, INITIAL_SYNC_RETRY_MS);

    let sessionTimer: number | null = null;
    const transitionAt = sessionEndsAt
      ? new Date(sessionEndsAt).getTime() + 1_000
      : null;
    const armTransitionTimer = () => {
      if (transitionAt === null || disposed) return;
      const remaining = transitionAt - Date.now();
      if (remaining <= 0) {
        refresh();
        return;
      }
      sessionTimer = window.setTimeout(
        armTransitionTimer,
        Math.min(remaining, MAX_TIMEOUT_MS),
      );
    };
    if (sessionEndsAt) {
      armTransitionTimer();
    }
    const heartbeatTimer = window.setInterval(refresh, HEARTBEAT_MS);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (sessionTimer !== null) window.clearTimeout(sessionTimer);
      if (initialSyncTimer !== null) window.clearTimeout(initialSyncTimer);
      window.clearInterval(heartbeatTimer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [classId, router, sessionEndsAt]);
}
