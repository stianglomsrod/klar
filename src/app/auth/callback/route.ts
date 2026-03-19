import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /auth/callback
 *
 * Handles Supabase magic-link (and email confirmation) redirects.
 * Exchanges the ?code= parameter for a session, then redirects
 * based on the user's role.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
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

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return response; // Falls back to /login
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
      response.headers.set(
        "location",
        new URL("/teacher", origin).toString(),
      );
    } else if (profile?.role === "student") {
      response.headers.set(
        "location",
        new URL("/student", origin).toString(),
      );
    }
  }

  return response;
}
