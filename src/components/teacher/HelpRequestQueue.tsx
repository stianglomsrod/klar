"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, Clock } from "lucide-react";

type HelpRequest = {
  id: string;
  student_id: string;
  created_at: string;
  status: "pending" | "in_progress" | "resolved" | "cancelled";
  full_name: string;
  avatar_url: string | null;
};

type HelpRequestQueueProps = {
  classId: string;
};

export default function HelpRequestQueue({ classId }: HelpRequestQueueProps) {
  const [queue, setQueue] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch initial queue
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("help_requests")
        .select(
          `
          id,
          student_id,
          created_at,
          status,
          profiles!student_id (
            full_name,
            avatar_url
          )
          `
        )
        .eq("class_id", classId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Transform data to flatten profiles
      const transformed = (data || []).map((req: any) => ({
        id: req.id,
        student_id: req.student_id,
        created_at: req.created_at,
        status: req.status,
        full_name: req.profiles?.full_name || "Unknown",
        avatar_url: req.profiles?.avatar_url || null,
      }));

      setQueue(transformed);
    } catch (error) {
      console.error("Error fetching help queue:", error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time changes
  useEffect(() => {
    fetchQueue();

    // Subscribe to changes on help_requests table
    const channel = supabase
      .channel(`help_requests_${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_requests",
          filter: `class_id=eq.${classId}`,
        },
        (payload: any) => {
          console.log("Help request change detected:", payload);
          // Refetch on any change (insert, update, delete)
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Helper to calculate wait time with color coding
  const getWaitTimeWithColor = (
    createdAt: string
  ): { text: string; colorClass: string } => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    let text = "";
    let colorClass = "";

    if (diffMins < 1) {
      text = "nå";
      colorClass = "text-slate-500";
    } else if (diffMins === 1) {
      text = "1 min";
      colorClass = "text-slate-500";
    } else if (diffMins < 5) {
      text = `${diffMins} min`;
      colorClass = "text-slate-500";
    } else if (diffMins < 10) {
      const hours = Math.floor(diffMins / 60);
      if (hours >= 1) {
        text = `${hours} time${hours > 1 ? "r" : ""}`;
      } else {
        text = `${diffMins} min`;
      }
      colorClass = "text-orange-600 font-medium";
    } else {
      const hours = Math.floor(diffMins / 60);
      if (hours >= 1) {
        text = `${hours} time${hours > 1 ? "r" : ""}`;
      } else {
        text = `${diffMins} min`;
      }
      colorClass = "text-red-600 font-bold animate-pulse";
    }

    return { text, colorClass };
  };

  // Update help request status to resolved
  const updateStatus = async (requestId: string, newStatus: string) => {
    setUpdating(requestId);
    try {
      const { error } = await supabase
        .from("help_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      // Optimistically remove from queue (real-time listener will also handle this)
      setQueue((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error("Error updating help request:", error);
      // Refetch to restore correct state on error
      fetchQueue();
    } finally {
      setUpdating(null);
    }
  };

  // Return null if queue is empty
  if (!loading && queue.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-4 py-3 pl-20 border-b border-slate-200 bg-blue-50">
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4 animate-spin" />
            Laster hjelpekø...
          </div>
        ) : (
          queue.map((request, index) => {
            const { text: waitText, colorClass: waitColor } =
              getWaitTimeWithColor(request.created_at);

            return (
              <div
                key={request.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 hover:shadow-sm transition-shadow"
              >
                {/* Queue Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm text-white">
                  {index + 1}
                </div>

                {/* Avatar & Name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xs flex items-center justify-center">
                    {request.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={request.avatar_url}
                        alt={request.full_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      request.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {request.full_name}
                  </span>
                </div>

                {/* Wait Time with Color Coding */}
                <div className={`text-xs flex-shrink-0 min-w-max ${waitColor}`}>
                  ventet {waitText}
                </div>

                {/* Single Action Button */}
                <button
                  onClick={() => updateStatus(request.id, "resolved")}
                  disabled={updating === request.id}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
                  title="Merk som ferdig"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {updating === request.id ? "..." : "Ferdig"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
