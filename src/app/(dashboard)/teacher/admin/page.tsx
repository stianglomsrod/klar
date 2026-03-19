"use client";

import { useTeacherProfile } from "@/contexts/TeacherProfileContext";
import { Shield } from "lucide-react";
import SubstituteManager from "@/components/teacher/SubstituteManager";

export default function AdminSubstitutesPage() {
  const { profile, loading } = useTeacherProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-16 w-16 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-700">Ingen tilgang</h1>
        <p className="text-slate-500">
          Denne siden er kun tilgjengelig for administratorer.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Vikarstyring</h1>
        <p className="text-slate-500 mt-1">
          Aktiver vikarkontoer, tildel klasser og generer innloggingslenker.
        </p>
      </div>

      <SubstituteManager />
    </div>
  );
}
