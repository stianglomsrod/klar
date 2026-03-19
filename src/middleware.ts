import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js Middleware — Role-based route protection
 *
 * Protects /teacher routes and teacher-only API routes:
 * - Unauthenticated users → redirect to /login
 * - Students trying to access /teacher → redirect to /student
 * - Students trying to hit teacher-only API routes → 403
 *
 * Public routes (/login, /api/push/react, static assets) are excluded.
 */

// Routes that require teacher role
const TEACHER_ROUTE_PREFIX = "/teacher";
const TEACHER_API_PREFIXES = ["/api/push/subscribe", "/api/seed"];

// Routes that skip middleware entirely
const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/push/react", "/api/push/send"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isTeacherRoute(pathname: string): boolean {
  return pathname.startsWith(TEACHER_ROUTE_PREFIX);
}

function isTeacherApiRoute(pathname: string): boolean {
  return TEACHER_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths and static assets
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Only check protected routes
  if (!isTeacherRoute(pathname) && !isTeacherApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Create a response we can modify (to set refreshed cookies)
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward refreshed cookies to both the request and response
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // 1. Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in → redirect to login (for pages) or 401 (for API)
    if (isTeacherApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Verify teacher role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher") {
    // Authenticated but not a teacher → redirect to student dashboard or 403
    if (isTeacherApiRoute(pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const studentUrl = new URL("/student", request.url);
    return NextResponse.redirect(studentUrl);
  }

  // Teacher confirmed — allow through
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, *.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp (static assets)
     * - sounds/ (audio assets)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$|sounds/).*)",
  ],
};
