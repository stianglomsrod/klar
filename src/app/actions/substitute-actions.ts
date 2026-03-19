"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export type SubstituteAccount = {
  id: string;
  email: string;
  full_name: string | null;
  is_substitute: boolean;
};

/**
 * Fetches all substitute profiles with emails from auth.users.
 * Requires: caller must be an admin teacher.
 * Email lives in auth.users (not profiles), so we need the admin client.
 */
export async function getSubstituteAccounts(): Promise<SubstituteAccount[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return [];

  // Verify caller is an admin teacher
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "teacher" || !caller?.is_admin) return [];

  // Admin client to access auth.users
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch substitute profiles
  const { data: subs } = await admin
    .from("profiles")
    .select("id, full_name, is_substitute")
    .eq("is_substitute", true)
    .order("full_name");

  if (!subs?.length) return [];

  // Fetch emails from auth.users via individual getUserById calls
  // (listUsers bulk endpoint fails with "Database error finding users")
  const emailMap = new Map<string, string>();
  await Promise.all(
    subs.map(async (s) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(s.id);
        if (error) {
          console.error(`getUserById error for ${s.id}:`, error);
        } else if (data?.user?.email) {
          emailMap.set(s.id, data.user.email);
        }
      } catch (err) {
        console.error(`getUserById exception for ${s.id}:`, err);
      }
    }),
  );

  return subs.map((s) => ({
    id: s.id,
    email: emailMap.get(s.id) ?? "",
    full_name: s.full_name,
    is_substitute: s.is_substitute,
  }));
}
