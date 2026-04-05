"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toggleQueueParticipation } from "@/app/actions/queue-actions";

type QueueToggleProps = {
  targetId: string;
  targetType: "class" | "group";
  /** Whether this teacher is currently participating in this queue */
  isActive: boolean;
  /** Callback after toggle completes (success or failure) */
  onToggled?: (newState: boolean) => void;
};

export default function QueueToggle({
  targetId,
  targetType,
  isActive,
  onToggled,
}: QueueToggleProps) {
  const [optimistic, setOptimistic] = useState(isActive);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sync with parent when isActive prop changes
  if (isActive !== optimistic && !isPending) {
    setOptimistic(isActive);
  }

  const handleToggle = () => {
    const previous = optimistic;
    const next = !previous;
    setOptimistic(next);
    setError(null);

    startTransition(async () => {
      const result = await toggleQueueParticipation(targetId, targetType);
      if (result.success) {
        setOptimistic(result.isParticipating);
        onToggled?.(result.isParticipating);
      } else {
        // Revert on failure
        setOptimistic(previous);
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500 select-none">Hjelpekø</label>
      {isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <Switch checked={optimistic} onCheckedChange={handleToggle} />
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
