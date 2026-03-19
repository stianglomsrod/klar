import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createHmac } from "crypto";

// Configure VAPID keys from environment
webpush.setVapidDetails(
  "mailto:admin@klar.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

/**
 * Creates a per-notification HMAC token from taskId + studentId.
 * The master secret never leaves the server — only the derived token
 * is embedded in the push payload.
 */
function createReactionToken(taskId: string, studentId: string): string {
  const secret = process.env.PUSH_REACT_SECRET || "";
  return createHmac("sha256", secret)
    .update(`${taskId}:${studentId}`)
    .digest("base64url");
}

/**
 * POST /api/push/send
 *
 * Sends a push notification to the teacher who created a task
 * when a student completes it — IF the teacher has opted in
 * for that specific student.
 *
 * Body: { taskId, studentId, studentName, taskTitle }
 *
 * Called by the student's browser (fire-and-forget) after task completion.
 */
export async function POST(req: NextRequest) {
  try {
    const { taskId, studentId, studentName, taskTitle } = await req.json();
    console.log("[PUSH TRACE] ── Endpoint hit ──", { taskId, studentId, studentName, taskTitle });

    if (!taskId || !studentId) {
      console.log("[PUSH TRACE] ✗ Missing fields — aborting");
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Authenticate caller (must be a valid logged-in user)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("[PUSH TRACE] 1. Auth:", user ? `uid=${user.id}` : "NO USER");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin client — bypasses RLS so we can read teacher settings/subscriptions
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 2. Look up the teacher who created this task
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select("created_by")
      .eq("id", taskId)
      .single();

    console.log("[PUSH TRACE] 2. Task lookup:", { created_by: task?.created_by, error: taskError?.message ?? null });
    if (taskError || !task?.created_by) {
      console.log("[PUSH TRACE] ✗ No teacher found — exiting");
      return NextResponse.json({ ok: true });
    }

    const teacherId = task.created_by;

    // 3. Check if teacher has push enabled for this student
    const { data: settings, error: settingsError } = await admin
      .from("student_teacher_settings")
      .select("push_enabled")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .single();

    console.log("[PUSH TRACE] 3. Settings:", { settings, error: settingsError?.message ?? null, callerIsStudent: user.id === studentId });
    if (!settings?.push_enabled) {
      console.log("[PUSH TRACE] ✗ push_enabled is falsy — exiting (likely RLS: student cannot read teacher's settings row)");
      return NextResponse.json({ ok: true });
    }

    // 4. Fetch all push subscriptions for the teacher
    const { data: subscriptions, error: subError } = await admin
      .from("push_subscriptions")
      .select("subscription_data, device_type")
      .eq("user_id", teacherId);

    console.log("[PUSH TRACE] 4. Subscriptions:", { count: subscriptions?.length ?? 0, error: subError?.message ?? null });
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[PUSH TRACE] ✗ No subscriptions — exiting");
      return NextResponse.json({ ok: true });
    }

    // 5. Build notification payload (HMAC token — master secret never exposed)
    const reactionToken = createReactionToken(taskId, studentId);
    const payload = JSON.stringify({
      title: `${studentName || "Elev"} leverte oppgave`,
      body: taskTitle || "En oppgave er fullført",
      taskId,
      studentId,
      reactionToken,
    });
    console.log("[PUSH TRACE] 5. Payload built:", payload);

    // 6. Send push to all teacher devices
    const sendPromises = subscriptions.map(async (sub) => {
      console.log("[PUSH TRACE] 6. Sending to device:", sub.device_type);
      try {
        const result = await webpush.sendNotification(
          sub.subscription_data as webpush.PushSubscription,
          payload,
        );
        console.log("[PUSH TRACE] ✓ webpush success:", { statusCode: result.statusCode, headers: result.headers });
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        const body = (err as { body?: string })?.body;
        console.error("[PUSH TRACE] ✗ webpush FAILED:", { statusCode, body, message: (err as Error)?.message });
        // Remove stale subscriptions (410 Gone or 404 Not Found)
        if (statusCode === 410 || statusCode === 404) {
          console.log("[PUSH TRACE]   → Deleting stale subscription");
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("user_id", teacherId)
            .eq("device_type", sub.device_type);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    console.log("[PUSH TRACE] ── Done ──");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUSH TRACE] ✗ Unhandled error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
