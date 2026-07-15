"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, Loader2, Copy, Check, UserPlus } from "lucide-react";
import { createStudent } from "@/app/actions/student-actions";
import ClassCombobox from "./ClassCombobox";

// ── Types ────────────────────────────────────────────

type SuccessData = {
  fullName: string;
  username: string;
  password: string;
};

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Helpers ──────────────────────────────────────────

/** "5A" → "5. Trinn", "10B" → "10. Trinn" */
function inferGradeName(className: string): string {
  const match = className.match(/^(\d+)/);
  return match ? `${match[1]}. Trinn` : "Annet";
}

// ── Component ────────────────────────────────────────
export default function AddStudentModal({
  isOpen,
  onClose,
  onSuccess,
}: AddStudentModalProps) {
  // Form state
  const [fullName, setFullName] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Success state
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Focus name input on open ───────────────────────
  useEffect(() => {
    if (isOpen && !successData) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen, successData]);

  // ── Handle class selection from ClassCombobox ──────
  const handleClassSelected = useCallback(
    (className: string, level: number | null) => {
      setSelectedClass(className);
      setSelectedGrade(level ? `${level}. Trinn` : inferGradeName(className));
    },
    [],
  );

  // ── Submit ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Skriv inn elevens fulle navn.");
      return;
    }
    if (!selectedClass.trim()) {
      setError("Velg eller opprett en klasse.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createStudent({
        fullName: fullName.trim(),
        className: selectedClass,
        gradeName: selectedGrade || inferGradeName(selectedClass),
      });

      if (result.success) {
        setSuccessData({
          fullName: result.fullName,
          username: result.username,
          password: result.password,
        });
      } else {
        setError(result.error);
      }
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Copy credentials ───────────────────────────────
  const handleCopy = () => {
    if (!successData) return;
    const text = `Brukernavn: ${successData.username}\nPassord: ${successData.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Close & reset ──────────────────────────────────
  const handleClose = () => {
    if (successData) onSuccess?.();
    setFullName("");
    setSelectedClass("");
    setSelectedGrade("");
    setError("");
    setSuccessData(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Legg til elev
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 pb-8">
          {successData ? (
            /* ── Success State ──────────────────────── */
            <div className="text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                {successData.fullName} er lagt til!
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Her er innloggingsinformasjonen til eleven.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-6">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">
                    Brukernavn
                  </p>
                  <p className="text-lg font-mono font-semibold text-slate-900">
                    {successData.username}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">
                    Passord
                  </p>
                  <p className="text-lg font-mono font-semibold text-slate-900">
                    {successData.password}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Kopier innloggingsinfo
                    </>
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Lukk
                </button>
              </div>
            </div>
          ) : (
            /* ── Form State ─────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full name */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Fullt navn
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="F.eks. Ole Oppfinner"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              {/* Class combobox — uses shared ClassCombobox in form mode */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Klasse
                </label>
                <ClassCombobox
                  initialClassName={null}
                  mode="form"
                  hideLabel
                  onClassChanged={handleClassSelected}
                />
                {selectedClass && (
                  <p className="text-xs text-green-600 mt-1">
                    Valgt: {selectedClass}{" "}
                    {selectedGrade && `(${selectedGrade})`}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Oppretter elev…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Legg til elev
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
