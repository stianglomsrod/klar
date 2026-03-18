"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Settings } from "lucide-react";

/** Convert a URL-safe base64 VAPID key to the Uint8Array that PushManager wants */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

interface StudentSettingsCardProps {
  studentId: string;
  initialWelcomeMessage: string;
  initialStreakEnabled?: boolean;
  initialStreakMode?: string;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

export default function StudentSettingsCard({
  studentId,
  initialWelcomeMessage,
  initialStreakEnabled = false,
  initialStreakMode = "classic",
  showToast,
}: StudentSettingsCardProps) {
  const supabase = createClient();
  const teacherIdRef = useRef<string | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [flowerGameEnabled, setFlowerGameEnabled] = useState(true); // TODO: Wire to DB (student_profiles.show_flower_garden)
  const [welcomeMessage, setWelcomeMessage] = useState(initialWelcomeMessage);
  const [streakEnabled, setStreakEnabled] = useState(initialStreakEnabled);
  const [streakMode, setStreakMode] = useState(initialStreakMode);
  const [streakSaving, setStreakSaving] = useState(false);

  // Load teacher id + current push_enabled state on mount
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      teacherIdRef.current = user.id;

      const { data } = await supabase
        .from("student_teacher_settings")
        .select("push_enabled")
        .eq("student_id", studentId)
        .eq("teacher_id", user.id)
        .maybeSingle();

      if (data) setNotificationsEnabled(data.push_enabled ?? false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  /** Toggle push notifications on/off */
  const handleTogglePush = useCallback(async () => {
    const teacherId = teacherIdRef.current;
    if (!teacherId || pushLoading) return;
    setPushLoading(true);

    const newState = !notificationsEnabled;

    try {
      if (newState) {
        // --- Enable ---
        // 1. Ask browser permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          showToast("Du må tillate varsler i nettleseren.", "warning");
          setPushLoading(false);
          return;
        }

        // 2. Subscribe via PushManager
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) throw new Error("VAPID key mangler");

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        // 3. Save subscription on server
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceType: /Mobi|Android/i.test(navigator.userAgent)
              ? "mobile"
              : "desktop",
          }),
        });

        if (!res.ok) throw new Error("Kunne ikke lagre abonnement");
      }

      // 4. Persist toggle state in student_teacher_settings
      const { error } = await supabase.from("student_teacher_settings").upsert(
        {
          student_id: studentId,
          teacher_id: teacherId,
          push_enabled: newState,
        },
        { onConflict: "student_id,teacher_id" },
      );

      if (error) throw error;
      setNotificationsEnabled(newState);
      showToast(
        newState ? "Push-varsler aktivert 🔔" : "Push-varsler deaktivert",
        "success",
      );
    } catch {
      showToast("Kunne ikke endre varselinnstilling. Prøv igjen.", "error");
    } finally {
      setPushLoading(false);
    }
  }, [notificationsEnabled, pushLoading, studentId, supabase, showToast]);

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

  const handleToggleStreak = async () => {
    if (streakSaving) return;
    setStreakSaving(true);
    const newState = !streakEnabled;
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ streak_enabled: newState })
        .eq("id", studentId);
      if (error) throw error;
      setStreakEnabled(newState);
      showToast(
        newState ? "Nærværsstjerner aktivert ⭐" : "Nærværsstjerner deaktivert",
        "success",
      );
    } catch {
      showToast("Kunne ikke endre innstilling. Prøv igjen.", "error");
    } finally {
      setStreakSaving(false);
    }
  };

  const handleChangeStreakMode = async (mode: string) => {
    if (streakSaving || mode === streakMode) return;
    setStreakSaving(true);
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ streak_mode: mode })
        .eq("id", studentId);
      if (error) throw error;
      setStreakMode(mode);
      showToast(
        mode === "classic"
          ? "Modus: Klassisk (sammenhengende)"
          : "Modus: Samlet (totalt)",
        "success",
      );
    } catch {
      showToast("Kunne ikke endre modus. Prøv igjen.", "error");
    } finally {
      setStreakSaving(false);
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
            onClick={handleTogglePush}
            disabled={pushLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
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

        {/* Attendance Streak Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-900 block mb-1">
              ⭐ Nærværsstjerner
            </label>
            <p className="text-xs text-slate-600">Belønner daglig oppmøte</p>
          </div>
          <button
            onClick={handleToggleStreak}
            disabled={streakSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
              streakEnabled ? "bg-amber-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                streakEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Streak Mode Selector (visible when streak enabled) */}
        {streakEnabled && (
          <div className="pl-2 border-l-2 border-amber-200 space-y-2">
            <p className="text-xs font-medium text-slate-700">Streak-modus:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleChangeStreakMode("classic")}
                disabled={streakSaving}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                  streakMode === "classic"
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                🔥 Klassisk
                <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                  Sammenhengende dager
                </span>
              </button>
              <button
                onClick={() => handleChangeStreakMode("accumulated")}
                disabled={streakSaving}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                  streakMode === "accumulated"
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                📈 Samlet
                <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                  Totalt antall dager
                </span>
              </button>
            </div>
          </div>
        )}

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
