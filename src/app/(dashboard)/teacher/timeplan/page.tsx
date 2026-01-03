"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WeeklyScheduleEditor from "@/components/teacher/WeeklyScheduleEditor";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";

type Class = {
  id: string;
  name: string;
};

export default function TimeplanPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");

      if (error) throw error;

      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-slate-400">Laster klasser...</div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6"
        >
          <ArrowLeft size={20} />
          Tilbake
        </button>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900">
          Ingen klasser funnet. Opprett klasser før du legger til timeplan.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6"
      >
        <ArrowLeft size={20} />
        Tilbake
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Timeplan</h1>

        {/* Class Selector */}
        <div className="flex items-center gap-4">
          <label
            htmlFor="class-select"
            className="text-sm font-medium text-slate-700"
          >
            Velg klasse:
          </label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule Editor */}
      {selectedClassId && <WeeklyScheduleEditor classId={selectedClassId} />}
    </div>
  );
}
