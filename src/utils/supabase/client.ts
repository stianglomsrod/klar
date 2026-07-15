import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseEnvironment } from '@/lib/env/public'

export function createClient() {
  const { url, anonKey } = getPublicSupabaseEnvironment()
  return createBrowserClient(url, anonKey)
}
