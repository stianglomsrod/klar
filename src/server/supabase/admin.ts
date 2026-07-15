import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnvironment } from "@/lib/env/server";
import type { Database } from "./database.types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const { url, serviceRoleKey } = getSupabaseAdminEnvironment();
  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return adminClient;
}
