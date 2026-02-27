"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Settings } from "lucide-react";

interface StudentSettingsCardProps {
  studentId: string;
  initialWelcomeMessage: string;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

export default function StudentSettingsCard({
  studentId,
  initialWelcomeMessage,
  showToast,
}: StudentSettingsCardProps) {
  const supabase = createClient();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true); // TODO: Wire to DB (student_teacher_settings)
  const [flowerGameEnabled, setFlowerGameEnabled] = useState(true); // TODO: Wire to DB (student_profiles.show_flower_garden)
  const [welcomeMessage, setWelcomeMessage] = useState(initialWelcomeMessage);

  const handleSaveWelcomeMessage = async () => {
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ custom_welcome_message: welcomeMessage })
        .eq("id", studentId);

      if (error) throw error;
      showToast("Velkomstmelding lagret!", "success");
    } catch {
      showToast("Kunne ikke lagre velkomstmelding. Prøv igjen.", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Innstillinger & Preferanser
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {/* Push Notifications Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-900 block mb-1">
              🔔 Push-varsler
            </label>
            <p className="text-xs text-slate-600">Varsle lærer ved levering</p>
          </div>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              notificationsEnabled ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notificationsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Flower Game Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-900 block mb-1">
              🌸 Blomster-spill
            </label>
            <p className="text-xs text-slate-600">Tilgang til minispill</p>
          </div>
          <button
            onClick={() => setFlowerGameEnabled(!flowerGameEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              flowerGameEnabled ? "bg-green-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                flowerGameEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Welcome Message */}
        <div>
          <label className="text-sm font-medium text-slate-900 block mb-2">
            Velkomstmelding
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Skriv en personlig melding..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
          />
          <button
            onClick={handleSaveWelcomeMessage}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Lagre melding
          </button>
        </div>
      </div>
    </div>
  );
}
