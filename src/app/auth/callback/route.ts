import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * GET /auth/callback
 *
 * Handles Supabase auth redirects. Supports two flows:
 *   1. PKCE: ?code=... → exchangeCodeForSession
 *   2. OTP verify: ?token_hash=...&type=... → verifyOtp (magic links via admin API)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const response = NextResponse.redirect(new URL("/login", origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let authError: Error | null = null;

  if (code) {
    // Flow 1: PKCE code exchange
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    // Flow 2: Direct OTP verification (magic links generated via admin API)
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authError = error;
  }

  if (authError) {
    console.error("Auth callback error:", authError.message, authError);

    // Double-fire guard: the first execution may have already consumed the
    // code and established a session. Check before giving up.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return response; // No session at all — genuine failure, redirect to /login
    }

    // Session exists from the earlier successful exchange — continue normally.
  }

  // Determine redirect based on role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "teacher") {
      response.headers.set("location", new URL("/teacher", origin).toString());
    } else if (profile?.role === "student") {
      response.headers.set("location", new URL("/student", origin).toString());
    }
  }

  return response;
}
