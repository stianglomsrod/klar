"use client";

import { Calendar, CheckCircle, Zap } from "lucide-react";
import {
  useTeacherProfile,
  getDisplayName,
} from "@/contexts/TeacherProfileContext";

export default function TeacherDashboard() {
  const { profile, loading } = useTeacherProfile();
  const firstName = loading
    ? "..."
    : (getDisplayName(profile).split(" ")[0] ?? "Lærer");

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Hei, {firstName} 👋
        </h1>
        <p className="text-slate-600">
          Velkommen til lærer dashboardet. Her kan du administrere klasser,
          oppgaver og følge med på elevenes fremgang.
        </p>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Dagens Melding */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Dagens Melding
            </h2>
          </div>

          <div className="space-y-3">
            <textarea
              placeholder="Skriv en melding til elevene..."
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={4}
            />
            <button className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              Send Melding
            </button>
          </div>
        </div>

        {/* Widget 2: Venter på godkjenning */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Venter på godkjenning
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Fullførte oppgaver
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Trykk for å se detaljer
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-700 font-bold">
                0
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors">
                Se alle
              </button>
            </div>
          </div>
        </div>

        {/* Widget 3: Hurtighandlinger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Hurtighandlinger
            </h2>
          </div>

          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors text-left">
              + Ny oppgave
            </button>
            <button className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg transition-colors text-left">
              + Legg til elev
            </button>
            <button className="w-full px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium rounded-lg transition-colors text-left">
              📊 Vis statistikk
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Section (Placeholder) */}
      <div className="mt-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Siste aktivitet
          </h2>
          <div className="text-center py-12">
            <p className="text-slate-500">
              Ingen aktivitet å vise ennå. Dette vil vise nylig gjennomførte
              oppgaver og elevaktivitet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
