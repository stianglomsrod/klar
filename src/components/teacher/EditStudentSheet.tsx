"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Student = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  show_flower_garden: boolean;
  custom_welcome_message: string | null;
};

type EditStudentSheetProps = {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    studentId: string,
    updates: {
      show_flower_garden: boolean;
      custom_welcome_message: string | null;
    }
  ) => Promise<void>;
};

export default function EditStudentSheet({
  student,
  isOpen,
  onClose,
  onSave,
}: EditStudentSheetProps) {
  const [showFlowerGarden, setShowFlowerGarden] = useState(
    student.show_flower_garden
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    student.custom_welcome_message || ""
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when student changes
  useEffect(() => {
    setShowFlowerGarden(student.show_flower_garden);
    setWelcomeMessage(student.custom_welcome_message || "");
  }, [student]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(student.id, {
        show_flower_garden: showFlowerGarden,
        custom_welcome_message: welcomeMessage.trim() || null,
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
                  {student.avatar_url ? (
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
                  <h2 className="text-lg font-bold text-slate-900">
                    {student.full_name}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {student.class_name || "Ingen klasse"} • Lvl {student.level}
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

              {/* Info Section */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Elevinfo
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-600">Elev-ID:</dt>
                    <dd className="text-slate-900 font-mono text-xs">
                      {student.id.slice(0, 8)}...
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-600">Klasse:</dt>
                    <dd className="text-slate-900 font-medium">
                      {student.class_name || "Ikke tildelt"}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-600">Nivå:</dt>
                    <dd className="text-slate-900 font-medium">
                      Level {student.level}
                    </dd>
                  </div>
                </dl>
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
