"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Switch } from "@/components/ui/switch";

type ClassMonitorToggleProps = {
  classId: string;
};

export default function ClassMonitorToggle({
  classId,
}: ClassMonitorToggleProps) {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("classes")
          .select("is_queue_open")
          .eq("id", classId)
          .single();

        if (fetchError) throw fetchError;
        if (isMounted) {
          setIsActive(Boolean(data?.is_queue_open));
        }
      } catch (err) {
        console.error("Error fetching queue status:", err);
        if (isMounted) setError("Kunne ikke hente køstatus");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const channel = supabase
      .channel(`classes-queue-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classes",
          filter: `id=eq.${classId}`,
        },
        (payload) => {
          const next = (payload.new as { is_queue_open?: boolean })
            ?.is_queue_open;
          setIsActive(Boolean(next));
        }
      )
      .subscribe();

    loadInitial();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [classId, supabase]);

  const handleToggle = async (_nextChecked: boolean) => {
    const previous = isActive;
    const nextValue = !previous;
    setIsActive(nextValue);
    setError(null);

    const { error: updateError } = await supabase
      .from("classes")
      .update({ is_queue_open: nextValue })
      .eq("id", classId);

    if (updateError) {
      console.error("Error toggling queue:", updateError);
      setIsActive(previous);
      setError("Kunne ikke oppdatere status");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor={`monitor-toggle-${classId}`}
        className="text-sm font-medium text-gray-700"
      >
        Hjelpekø
      </label>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      ) : (
        <Switch
          checked={isActive}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      )}

      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </div>
  );
}
