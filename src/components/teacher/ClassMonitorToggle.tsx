"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Switch } from "@/components/ui/switch";

type ClassMonitorToggleProps = {
  classId: string;
  teacherId: string;
};

export default function ClassMonitorToggle({
  classId,
  teacherId,
}: ClassMonitorToggleProps) {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Check initial state on mount
  useEffect(() => {
    const checkActiveSession = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("teacher_active_sessions")
          .select("*")
          .eq("teacher_id", teacherId)
          .eq("class_id", classId)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          // PGRST116 = "no rows found", which is expected when inactive
          throw fetchError;
        }

        setIsActive(!!data);
      } catch (err: any) {
        console.error("Error checking active session:", err);
        setError("Kunne ikke sjekke status");
      } finally {
        setIsLoading(false);
      }
    };

    checkActiveSession();
  }, [classId, teacherId, supabase]);

  const handleToggle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isActive) {
        // DELETE session
        const { error: deleteError } = await supabase
          .from("teacher_active_sessions")
          .delete()
          .eq("teacher_id", teacherId)
          .eq("class_id", classId);

        if (deleteError) throw deleteError;
        setIsActive(false);
      } else {
        // INSERT session
        const { error: insertError } = await supabase
          .from("teacher_active_sessions")
          .insert([
            {
              teacher_id: teacherId,
              class_id: classId,
            },
          ]);

        if (insertError) throw insertError;
        setIsActive(true);
      }
    } catch (err: any) {
      console.error("Error toggling session:", err);
      setError(err?.message || "Noe gikk galt");
      // Show error toast if needed
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Label */}
      <label
        htmlFor={`monitor-toggle-${classId}`}
        className="text-sm font-medium text-gray-700"
      >
        Hjelpekø
      </label>

      {/* Switch */}
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      ) : (
        <Switch
          checked={isActive}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      )}

      {/* Error message */}
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </div>
  );
}
