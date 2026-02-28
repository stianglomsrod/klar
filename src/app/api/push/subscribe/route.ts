import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/push/subscribe
 *
 * Saves a teacher's push subscription to the database.
 * Called by the frontend after a successful PushManager.subscribe().
 *
 * Body: { subscription: PushSubscriptionJSON, deviceType: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { subscription, deviceType } = await req.json();

    if (!subscription || !deviceType) {
      return NextResponse.json(
        { error: "Missing subscription or deviceType" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Upsert subscription (composite PK: user_id + device_type)
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        subscription_data: subscription,
        device_type: deviceType,
      },
      { onConflict: "user_id,device_type" },
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
