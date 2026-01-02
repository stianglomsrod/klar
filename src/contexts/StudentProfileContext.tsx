"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";

export type StudentProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  points_earned: number;
  current_goal_total: number;
  current_xp: number;
  petals_progress: number;
  flowers_collected: number;
  petal_colors: string[];
  show_flower_garden: boolean;
  custom_welcome_message: string | null;
};

type StudentProfileContextType = {
  profile: StudentProfile | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<StudentProfile | null>;
};

const StudentProfileContext = createContext<
  StudentProfileContextType | undefined
>(undefined);

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfileData = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return null;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      let { data: studentData, error: studentError } = await supabase
        .from("student_profiles")
        .select(
          `
            level,
            points_earned,
            current_goal_total,
            current_xp,
            petals_progress,
            flowers_collected,
            petal_colors,
            show_flower_garden,
            custom_welcome_message
          `
        )
        .eq("id", user.id)
        .single();

      if (studentError && studentError.code === "PGRST116") {
        const { error: insertError } = await supabase
          .from("student_profiles")
          .insert({
            id: user.id,
            level: 1,
            points_earned: 0,
            current_goal_total: 1000,
            current_xp: 0,
            petals_progress: 0,
            flowers_collected: 0,
            petal_colors: [
              "#FFC0CB",
              "#FFC0CB",
              "#FFC0CB",
              "#FFC0CB",
              "#FFC0CB",
            ],
            show_flower_garden: true,
          });

        if (!insertError) {
          const { data: newStudentData } = await supabase
            .from("student_profiles")
            .select(
              `
                level,
                points_earned,
                current_goal_total,
                current_xp,
                petals_progress,
                flowers_collected,
                petal_colors,
                show_flower_garden,
                custom_welcome_message
              `
            )
            .eq("id", user.id)
            .single();
          studentData = newStudentData;
        }
      } else if (studentError) {
        throw studentError;
      }

      const mergedProfile: StudentProfile = {
        id: profileData.id,
        full_name: profileData.full_name || null,
        avatar_url: profileData.avatar_url || null,
        level: studentData?.level ?? 1,
        points_earned: studentData?.points_earned ?? 0,
        current_goal_total: studentData?.current_goal_total ?? 1000,
        current_xp: studentData?.current_xp ?? 0,
        petals_progress: studentData?.petals_progress ?? 0,
        flowers_collected: studentData?.flowers_collected ?? 0,
        petal_colors: studentData?.petal_colors ?? [
          "#FFC0CB",
          "#FFC0CB",
          "#FFC0CB",
          "#FFC0CB",
          "#FFC0CB",
        ],
        show_flower_garden: studentData?.show_flower_garden ?? true,
        custom_welcome_message: studentData?.custom_welcome_message || null,
      };

      setProfile(mergedProfile);
      setLoading(false);
      return mergedProfile;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const refresh = async () => {
    const result = await fetchProfileData();
    return result;
  };

  return (
    <StudentProfileContext.Provider
      value={{ profile, loading, error, refresh }}
    >
      {children}
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  const context = useContext(StudentProfileContext);
  if (context === undefined) {
    throw new Error(
      "useStudentProfile must be used within a StudentProfileProvider"
    );
  }
  return context;
}
