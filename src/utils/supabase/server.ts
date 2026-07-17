import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicSupabaseEnvironment } from '@/lib/env/public'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getPublicSupabaseEnvironment()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware handling
            // cookie setting as an alternative mechanism.
          }
        },
      },
      auth: {
        persistSession: false,
      },
    }
  )
}
