"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";

export type TeacherProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  is_admin: boolean;
};

type TeacherProfileContextType = {
  profile: TeacherProfile | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const TeacherProfileContext = createContext<
  TeacherProfileContextType | undefined
>(undefined);

export function TeacherProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role, is_admin")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setProfile({
        id: data.id,
        full_name: data.full_name,
        email: user.email ?? null,
        avatar_url: data.avatar_url,
        role: data.role,
        is_admin: data.is_admin ?? false,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <TeacherProfileContext.Provider
      value={{ profile, loading, error, refresh: fetchProfile }}
    >
      {children}
    </TeacherProfileContext.Provider>
  );
}

export function useTeacherProfile() {
  const context = useContext(TeacherProfileContext);
  if (context === undefined) {
    throw new Error(
      "useTeacherProfile must be used within a TeacherProfileProvider",
    );
  }
  return context;
}

/**
 * Generate initials from a full name.
 * "Ole Oppfinner" -> "OO", "Kari" -> "K", null -> fallback
 */
export function getInitials(
  fullName: string | null | undefined,
  fallback = "L",
): string {
  if (!fullName?.trim()) return fallback;
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/**
 * Get a display name with sensible fallbacks.
 * Tries full_name, then email prefix, then generic fallback.
 */
export function getDisplayName(
  profile: TeacherProfile | null,
  fallback = "Lærer",
): string {
  if (profile?.full_name?.trim()) return profile.full_name;
  if (profile?.email) return profile.email.split("@")[0];
  return fallback;
}
