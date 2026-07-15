"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, LogIn, UserRound } from "lucide-react";
import { signInPrototypeAction } from "@/app/actions/v3/auth-actions";
import type { SignInDestination } from "@/server/auth/sign-in";

const DESTINATIONS: Record<SignInDestination, string> = {
  student: "/v3/student",
  teacher: "/v3/teacher",
  "mfa-enroll": "/v3/mfa/enroll",
  "mfa-challenge": "/v3/mfa/challenge",
};

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signInPrototypeAction(identifier, password);
      if (!result.success) {
        setError(result.error);
        return;
      }

      router.replace(DESTINATIONS[result.destination]);
      router.refresh();
    } catch {
      setError("Innloggingen kunne ikke fullføres. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <section
          aria-labelledby="login-heading"
          className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9"
        >
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
              Klar 3.0
            </p>
            <h1 id="login-heading" className="text-3xl font-bold tracking-tight">
              Logg inn
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Bruk elevkoden du har fått, eller lærerens e-postadresse.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="text-sm font-semibold">
                Elevkode eller e-post
              </label>
              <div className="relative mt-2">
                <UserRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  disabled={loading}
                  required
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
                  placeholder="FURU-UGLE-1234"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-semibold">
                Passord
              </label>
              <div className="relative mt-2">
                <KeyRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  minLength={10}
                  maxLength={128}
                  required
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white transition hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-wait disabled:bg-slate-500"
            >
              <LogIn aria-hidden="true" className="h-5 w-5" />
              {loading ? "Logger inn …" : "Logg inn"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
