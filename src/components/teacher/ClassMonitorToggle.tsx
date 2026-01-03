"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={isLoading}
        title={isActive ? "Skru av hjelp varsler" : "Skru på hjelp varsler"}
        className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-all duration-200 ${
          isActive
            ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30"
            : "bg-slate-200 hover:bg-slate-300 text-slate-700"
        } ${isLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {isLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Bell
            size={20}
            className={isActive ? "fill-current" : ""}
            strokeWidth={isActive ? 0 : 2}
          />
        )}
        <span className="text-sm font-semibold">
          {isActive ? "Varsler PÅ" : "Varsler AV"}
        </span>
      </button>

      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  );
}
