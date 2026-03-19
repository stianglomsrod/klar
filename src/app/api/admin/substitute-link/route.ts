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

  // Verify the email belongs to a substitute account
  const { data: subProfile } = await admin
    .from("profiles")
    .select("id, is_substitute")
    .eq("email", email)
    .single();

  if (!subProfile?.is_substitute) {
    return NextResponse.json(
      { error: "Denne e-posten tilhører ikke en vikarkonto." },
      { status: 400 },
    );
  }

  // Generate magic link
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? "Kunne ikke generere lenke." },
      { status: 500 },
    );
  }

  // Build the verification URL the substitute clicks
  const magicLink = `${request.nextUrl.origin}/auth/callback?code=${linkData.properties.hashed_token}`;

  return NextResponse.json({ magicLink });
}
