"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: Authenticate with Supabase
      // Invisible email hack: bare usernames get @skole.klar.app appended
      const loginEmail = email.includes("@")
        ? email
        : `${email}@skole.klar.app`;

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

      if (authError) {
        setError(authError.message || "Feil brukernavn eller passord");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Kunne ikke logge inn. Prøv igjen.");
        setLoading(false);
        return;
      }

      // Step 2: Fetch user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        setError("Kunne ikke hente brukerprofil. Prøv igjen.");
        setLoading(false);
        return;
      }

      if (!profile) {
        setError("Brukerprofil ikke funnet.");
        setLoading(false);
        return;
      }

      // Step 3: Redirect based on role
      if (profile.role === "teacher") {
        router.push("/teacher");
      } else if (profile.role === "student") {
        router.push("/student");
      } else {
        console.warn("Unknown role:", profile.role);
        setError("Ukjent brukerrolle. Kontakt administrator.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("En feil oppstod. Prøv igjen senere.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white/20 backdrop-blur">
                <LogIn className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Klar</h1>
            </div>
            <p className="text-white/80 text-sm">Logg inn på din konto</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                Brukernavn eller e-post
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="brukernavn eller e-post"
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                Passord
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Logger inn...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Logg inn</span>
                </>
              )}
            </button>

            {/* Footer Link */}
            <div className="text-center pt-2">
              <a
                href="#"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Glemt passord?
              </a>
            </div>
          </form>

          {/* Additional Info */}
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-600">
              Kontakt din lærer eller administrator hvis du trenger hjelp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
