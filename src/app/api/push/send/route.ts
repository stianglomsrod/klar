import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

    if (!taskId || !studentId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Authenticate caller (must be a valid logged-in user)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Look up the teacher who created this task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("created_by")
      .eq("id", taskId)
      .single();

    if (taskError || !task?.created_by) {
      return NextResponse.json({ ok: true }); // No teacher — nothing to do
    }

    const teacherId = task.created_by;

    // 3. Check if teacher has push enabled for this student
    const { data: settings } = await supabase
      .from("student_teacher_settings")
      .select("push_enabled")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .single();

    if (!settings?.push_enabled) {
      return NextResponse.json({ ok: true }); // Push not enabled — silent exit
    }

    // 4. Fetch all push subscriptions for the teacher
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("subscription_data, device_type")
      .eq("user_id", teacherId);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true }); // No devices — silent exit
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

    // 6. Send push to all teacher devices
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription_data as webpush.PushSubscription,
          payload,
        );
      } catch (err: unknown) {
        // Remove stale subscriptions (410 Gone or 404 Not Found)
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", teacherId)
            .eq("device_type", sub.device_type);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
