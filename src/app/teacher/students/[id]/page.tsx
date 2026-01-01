"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";

type StudentProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchStudent = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, level, class_name")
        .eq("id", studentId)
        .single();

      if (error) throw error;
      setStudent(data);
    } catch (error) {
      console.error("Error fetching student:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600">Laster elevdata...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-slate-600 mb-4">Finner ikke eleven</p>
            <button
              onClick={() => router.push("/teacher/classes")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Tilbake til Mine Klasser
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Back Button */}
      <button
        onClick={() => router.push("/teacher/classes")}
        className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Tilbake</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-2xl flex-shrink-0">
            {student.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.avatar_url}
                alt={student.full_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              student.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {student.full_name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {student.class_name && (
                <span className="px-2.5 py-1 text-sm font-semibold text-blue-700 bg-blue-100 rounded-full">
                  {student.class_name}
                </span>
              )}
              <span className="px-2.5 py-1 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                Nivå {student.level}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="text-center py-12">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-400 mb-4">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Under konstruksjon
          </h2>
          <p className="text-slate-600 max-w-md mx-auto">
            Elevens dashbord er under utvikling. Her vil du snart kunne se
            detaljert fremgang, oppgaver, og annen informasjon.
          </p>
        </div>
      </div>
    </div>
  );
}
