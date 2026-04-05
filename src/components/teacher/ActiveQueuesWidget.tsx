"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { HandHelping, LogOut, Users, BookOpen } from "lucide-react";
import {
  getMyActiveQueuesDetailed,
  toggleQueueParticipation,
  type DetailedActiveQueue,
} from "@/app/actions/queue-actions";
import { createClient } from "@/utils/supabase/client";

type Props = {
  totalPendingCount: number;
  onOpenHelpQueue: () => void;
};

export default function ActiveQueuesWidget({
  totalPendingCount,
  onOpenHelpQueue,
}: Props) {
  const [queues, setQueues] = useState<DetailedActiveQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchQueues = useCallback(async () => {
    try {
      const data = await getMyActiveQueuesDetailed();
      setQueues(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  // Re-fetch when queue tables change
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("active_queues_widget")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_help_queues" },
        () => fetchQueues(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_queue_participants" },
        () => fetchQueues(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueues]);

  const handleLeave = (queue: DetailedActiveQueue) => {
    setLeavingId(queue.queueId);
    startTransition(async () => {
      const result = await toggleQueueParticipation(
        queue.targetId,
        queue.targetType,
      );
      if (result.success) {
        setQueues((prev) => prev.filter((q) => q.queueId !== queue.queueId));
      }
      setLeavingId(null);
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
          <HandHelping className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Hjelpekø</h2>
        </div>
        {totalPendingCount > 0 && (
          <div className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
            {totalPendingCount}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : queues.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">Ingen aktive køer</p>
          <p className="text-xs text-slate-400 mt-1">
            Aktiver en kø fra Mine Elever-siden
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queues.map((queue) => (
            <div
              key={queue.queueId}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              {/* Target icon */}
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white border border-slate-200 shrink-0">
                {queue.targetType === "class" ? (
                  <BookOpen className="h-4 w-4 text-slate-500" />
                ) : (
                  <Users className="h-4 w-4 text-slate-500" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {queue.targetName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {queue.pendingCount > 0 && (
                    <span className="text-xs font-medium text-blue-600">
                      {queue.pendingCount} venter
                    </span>
                  )}
                  {queue.participants.length > 0 && (
                    <span className="text-xs text-slate-400">
                      +{queue.participants.length}{" "}
                      {queue.participants.length === 1 ? "lærer" : "lærere"}
                    </span>
                  )}
                </div>
              </div>

              {/* Leave button */}
              <button
                onClick={() => handleLeave(queue)}
                disabled={isPending && leavingId === queue.queueId}
                className="shrink-0 p-2 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Forlat kø"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer: open full help queue */}
      <div className="pt-4 mt-4 border-t border-slate-100">
        <button
          onClick={onOpenHelpQueue}
          className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
        >
          Se alle forespørsler
        </button>
      </div>
    </div>
  );
}
