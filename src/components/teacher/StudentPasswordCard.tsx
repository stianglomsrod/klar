"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCw, Copy, Check, Loader2 } from "lucide-react";
import { resetStudentPassword } from "@/app/actions/student-actions";

interface StudentPasswordCardProps {
  studentId: string;
  initialPassword: string | null;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

export default function StudentPasswordCard({
  studentId,
  initialPassword,
  showToast,
}: StudentPasswordCardProps) {
  const [currentPassword, setCurrentPassword] = useState<string | null>(
    initialPassword,
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordResetting, setPasswordResetting] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const handleResetPassword = async () => {
    setPasswordResetting(true);
    const result = await resetStudentPassword(studentId);
    setPasswordResetting(false);
    if (result.success) {
      setCurrentPassword(result.newPassword);
      setPasswordVisible(true);
    } else {
      showToast(`Feil: ${result.error}`, "error");
    }
  };

  const handleCopyPassword = async () => {
    if (!currentPassword) return;
    await navigator.clipboard.writeText(currentPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-900 block mb-2">
        🔑 Passord
      </label>

      {/* Password display row */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="flex-1 text-sm font-mono text-slate-700 select-all truncate">
          {passwordVisible && currentPassword ? currentPassword : "••••••••"}
        </span>

        {/* Toggle visibility */}
        <button
          type="button"
          onClick={() => setPasswordVisible((v) => !v)}
          className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-500"
          title={passwordVisible ? "Skjul passord" : "Vis passord"}
        >
          {passwordVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>

        {/* Copy */}
        {currentPassword && (
          <button
            type="button"
            onClick={handleCopyPassword}
            className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-500"
            title="Kopier passord"
          >
            {passwordCopied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Generate new password button */}
      <button
        type="button"
        onClick={handleResetPassword}
        disabled={passwordResetting}
        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
      >
        {passwordResetting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Generer nytt passord
      </button>
    </div>
  );
}
