"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { isImageUrl } from "@/utils/avatar";
import type { TeacherStudent } from "@/types/shared";

type Student = TeacherStudent;

type EditStudentSheetProps = {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    studentId: string,
    updates: {
      show_flower_garden: boolean;
      custom_welcome_message: string | null;
      streak_enabled: boolean;
      streak_mode: "classic" | "accumulated";
    },
  ) => Promise<void>;
};

export default function EditStudentSheet({
  student,
  isOpen,
  onClose,
  onSave,
}: EditStudentSheetProps) {
  const [showFlowerGarden, setShowFlowerGarden] = useState(
    student.show_flower_garden,
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    student.custom_welcome_message || "",
  );
  const [streakEnabled, setStreakEnabled] = useState(student.streak_enabled);
  const [streakMode, setStreakMode] = useState<"classic" | "accumulated">(
    student.streak_mode,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when student changes
  useEffect(() => {
    setShowFlowerGarden(student.show_flower_garden);
    setWelcomeMessage(student.custom_welcome_message || "");
    setStreakEnabled(student.streak_enabled);
    setStreakMode(student.streak_mode);
  }, [student]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(student.id, {
        show_flower_garden: showFlowerGarden,
        custom_welcome_message: welcomeMessage.trim() || null,
        streak_enabled: streakEnabled,
        streak_mode: streakMode,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold flex-shrink-0">
                  {isImageUrl(student.avatar_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={student.avatar_url}
                      alt={student.full_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">
                      {student.avatar_url ||
                        student.full_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {student.full_name}
                    </h2>
                    <span className="px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                      Nivå {student.level}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {student.class_name || "Ingen klasse"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Settings Section */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Innstillinger
                </h3>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor="flower-garden-toggle"
                        className="text-sm font-medium text-slate-900 block mb-1"
                      >
                        Aktiver Blomsterhage
                      </label>
                      <p className="text-xs text-slate-600">
                        Eleven kan se og fargelegge kronblader når dette er
                        aktivert
                      </p>
                    </div>
                    <button
                      id="flower-garden-toggle"
                      onClick={() => setShowFlowerGarden(!showFlowerGarden)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        showFlowerGarden ? "bg-green-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showFlowerGarden ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Streak Settings */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor="streak-toggle"
                        className="text-sm font-medium text-slate-900 block mb-1"
                      >
                        Aktiver Streak 🔥
                      </label>
                      <p className="text-xs text-slate-600">
                        Eleven ser sin streak-teller på dashboardet
                      </p>
                    </div>
                    <button
                      id="streak-toggle"
                      onClick={() => setStreakEnabled(!streakEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        streakEnabled ? "bg-green-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          streakEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {streakEnabled && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <label className="text-xs font-medium text-slate-700 block mb-2">
                        Streak-modus
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStreakMode("classic")}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                            streakMode === "classic"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Klassisk
                        </button>
                        <button
                          onClick={() => setStreakMode("accumulated")}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                            streakMode === "accumulated"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Akkumulert
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        {streakMode === "classic"
                          ? "Nullstilles ved manglende dag"
                          : "Teller totale aktive dager"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Communication Section */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Kommunikasjon
                </h3>

                <div className="space-y-2">
                  <label
                    htmlFor="welcome-message"
                    className="text-sm font-medium text-slate-700 block"
                  >
                    Velkomstmelding
                  </label>
                  <textarea
                    id="welcome-message"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="La stå tom for å bruke standard melding..."
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Denne meldingen vil vises når eleven logger inn. La feltet
                    stå tomt for å bruke systemets standardmelding.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Lagrer...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lagre endringer
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
