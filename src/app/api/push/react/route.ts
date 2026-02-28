import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

/** The only emoji values we accept as reactions. */
const ALLOWED_REACTIONS = new Set(["👍", "🌟", "💪", "🎉"]);

/**
 * Verify the per-notification HMAC token.
 * Recomputes HMAC-SHA256(secret, taskId:studentId) and compares
 * in constant time to prevent timing attacks.
 */
function verifyReactionToken(
  taskId: string,
  studentId: string,
  token: string,
): boolean {
  const secret = process.env.PUSH_REACT_SECRET || "";
  const expected = createHmac("sha256", secret)
    .update(`${taskId}:${studentId}`)
    .digest("base64url");

  // Constant-time comparison
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false; // Different lengths → mismatch
  }
}

/**
 * POST /api/push/react
 *
 * Receives an emoji reaction from the Service Worker when a teacher
 * taps an action button on a push notification.
 *
 * Authenticated via X-Reaction-Token header (HMAC-signed, per-notification).
 * The master PUSH_REACT_SECRET never leaves the server.
 *
 * Body: { taskId, studentId, reaction }
 */
export async function POST(req: NextRequest) {
  try {
    const { taskId, studentId, reaction } = await req.json();

    if (!taskId || !studentId || !reaction) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1. Validate reaction is an allowed emoji
    if (!ALLOWED_REACTIONS.has(reaction)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    // 2. Verify HMAC token (replaces raw shared-secret check)
    const token = req.headers.get("X-Reaction-Token") || "";
    if (!verifyReactionToken(taskId, studentId, token)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service-role client — SW has no user session/cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Look up the teacher who created this task (to set teacher_id on feedback)
    const { data: task } = await supabase
      .from("tasks")
      .select("created_by")
      .eq("id", taskId)
      .single();

    // Upsert feedback with teacher reaction
    const { error } = await supabase.from("feedback").upsert(
      {
        task_id: taskId,
        student_id: studentId,
        teacher_reaction: reaction,
        ...(task?.created_by ? { teacher_id: task.created_by } : {}),
      },
      { onConflict: "task_id" },
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to save reaction" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
