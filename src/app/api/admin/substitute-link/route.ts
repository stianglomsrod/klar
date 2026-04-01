import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

/**
 * POST /api/admin/substitute-link
 *
 * Generates a magic link for a substitute teacher account.
 * Requires: caller must be a teacher with is_admin=true.
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Mangler serverkonfigurasjon." },
      { status: 500 },
    );
  }

  // Verify caller is an admin teacher via RLS-scoped client
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ikke autentisert." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher" || !profile?.is_admin) {
    return NextResponse.json({ error: "Ingen tilgang." }, { status: 403 });
  }

  // Parse body
  const body = await request.json();
  const email = body?.email;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "E-post er påkrevd." }, { status: 400 });
  }

  // Admin client for auth.admin operations
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the email belongs to a substitute account and generate magic link
  // generateLink returns the user object, so we can verify is_substitute from it
  const { data: inviteData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${request.nextUrl.origin}/auth/callback` },
  });

  // If we can't even create a link for this email, the user doesn't exist
  if (!inviteData?.user?.id) {
    return NextResponse.json(
      { error: "Ingen bruker funnet med denne e-posten." },
      { status: 400 },
    );
  }

  const { data: subProfile } = await admin
    .from("profiles")
    .select("id, is_substitute")
    .eq("id", inviteData.user.id)
    .single();

  if (!subProfile?.is_substitute) {
    return NextResponse.json(
      { error: "Denne e-posten tilhører ikke en vikarkonto." },
      { status: 400 },
    );
  }

  // generateLink() returns action_link pointing to Supabase's verification
  // endpoint (e.g. /auth/v1/verify?token=...&type=magiclink&redirect_to=...).
  // Supabase's verify endpoint may redirect with #access_token (implicit flow)
  // instead of ?code= (PKCE), which our server route can't read.
  //
  // Fix: extract the token_hash and type from the action_link and build a
  // direct URL to our callback, which can use verifyOtp server-side.
  const actionLink = inviteData?.properties?.action_link;

  if (!actionLink) {
    return NextResponse.json(
      { error: "Kunne ikke generere lenke." },
      { status: 500 },
    );
  }

  // Parse the Supabase action_link to extract token_hash and type
  const actionUrl = new URL(actionLink);
  const tokenHash = actionUrl.searchParams.get("token") ?? actionUrl.searchParams.get("token_hash");
  const type = actionUrl.searchParams.get("type") ?? "magiclink";

  if (!tokenHash) {
    // Fallback: return the raw Supabase action_link
    return NextResponse.json({ magicLink: actionLink });
  }

  // Build a direct link to our own callback with query params
  const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
  callbackUrl.searchParams.set("token_hash", tokenHash);
  callbackUrl.searchParams.set("type", type);

  return NextResponse.json({ magicLink: callbackUrl.toString() });
}
