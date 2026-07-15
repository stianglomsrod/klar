"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  beginTeacherMfaEnrollmentAction,
  verifyTeacherMfaAction,
} from "@/app/actions/v3/auth-actions";

type MfaPanelProps = {
  mode: "enroll" | "challenge";
};

export function MfaPanel({ mode }: MfaPanelProps) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | undefined>();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startEnrollment() {
    setLoading(true);
    setError(null);
    try {
      const result = await beginTeacherMfaEnrollmentAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFactorId(result.factorId);
      setQrCode(result.qrCode);
      setSecret(result.secret);
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await verifyTeacherMfaAction(code, factorId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace("/v3/teacher");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const enrollmentReady = mode === "challenge" || factorId;

  return (
    <section
      aria-labelledby="mfa-heading"
      className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
        Klar 3.0
      </p>
      <h1 id="mfa-heading" className="mt-2 text-3xl font-bold tracking-tight">
        {mode === "enroll" ? "Sikre lærerkontoen" : "Bekreft innloggingen"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {mode === "enroll"
          ? "Koble kontoen til en autentiseringsapp før du åpner lærerflaten."
          : "Skriv inn den seks-sifrede koden fra autentiseringsappen."}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {mode === "enroll" && !factorId && (
        <button
          type="button"
          onClick={startEnrollment}
          disabled={loading}
          className="mt-6 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
        >
          {loading ? "Starter …" : "Start sikkert oppsett"}
        </button>
      )}

      {qrCode && secret && (
        <div className="mt-6 rounded-2xl border border-slate-200 p-5">
          {/* The QR image is a short-lived data URL returned by Supabase Auth. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCode}
            alt="QR-kode for å legge Klar til i autentiseringsappen"
            className="mx-auto h-52 w-52"
          />
          <p className="mt-4 text-sm text-slate-600">
            Kan du ikke skanne? Skriv inn denne nøkkelen manuelt:
          </p>
          <code className="mt-2 block break-all rounded-lg bg-slate-100 p-3 text-sm">
            {secret}
          </code>
        </div>
      )}

      {enrollmentReady && (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <div>
            <label htmlFor="mfa-code" className="text-sm font-semibold">
              Sekssifret kode
            </label>
            <input
              id="mfa-code"
              name="mfa-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-[0.35em] outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:bg-slate-500"
          >
            {loading ? "Kontrollerer …" : "Bekreft og fortsett"}
          </button>
        </form>
      )}
    </section>
  );
}
