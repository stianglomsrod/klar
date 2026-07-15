import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getPublicSupabaseEnvironment,
  isLegacy2xEnabled,
  isPilotEnabled,
} from "@/lib/env/public";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
];

const LEGACY_PREFIXES = ["/teacher", "/student", "/subject", "/belonninger"];

function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathMatches(pathname, path));
}

function isLegacyPath(pathname: string): boolean {
  return LEGACY_PREFIXES.some((path) => pathMatches(pathname, path));
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathMatches(pathname, "/v3/unavailable")) return NextResponse.next();

  if (
    !isPilotEnabled() &&
    (pathMatches(pathname, "/v3") || pathMatches(pathname, "/login"))
  ) {
    return NextResponse.redirect(new URL("/v3/unavailable", request.url));
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (isLegacyPath(pathname) && !isLegacy2xEnabled()) {
    return redirectToLogin(request);
  }

  if (!pathMatches(pathname, "/v3")) return NextResponse.next();

  const response = NextResponse.next({
    request: { headers: request.headers },
  });
  const { url, anonKey } = getPublicSupabaseEnvironment();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectToLogin(request);

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id);
  const isTeacher = memberships?.some(
    (membership) =>
      membership.role === "owner" || membership.role === "teacher",
  );
  const isStudent = memberships?.some(
    (membership) => membership.role === "student",
  );

  if (pathMatches(pathname, "/v3/student")) {
    return isStudent ? response : redirectToLogin(request);
  }

  if (pathMatches(pathname, "/v3/mfa")) {
    return isTeacher ? response : redirectToLogin(request);
  }

  if (pathMatches(pathname, "/v3/teacher")) {
    if (!isTeacher) return redirectToLogin(request);

    const { data: assurance } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!assurance || assurance.currentLevel !== "aal2") {
      const destination =
        assurance?.nextLevel === "aal2"
          ? "/v3/mfa/challenge"
          : "/v3/mfa/enroll";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$|sounds/).*)",
  ],
};
