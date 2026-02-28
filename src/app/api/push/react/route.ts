import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/push/react
 *
 * Receives an emoji reaction from the Service Worker when a teacher
 * taps an action button on a push notification.
 *
 * Authenticated via X-Push-Secret header (shared secret from .env.local)
 * because the SW cannot carry browser auth cookies.
 *
 * Body: { taskId, studentId, reaction }
 */
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("X-Push-Secret");

    if (!secret || secret !== process.env.PUSH_REACT_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId, studentId, reaction } = await req.json();

    if (!taskId || !studentId || !reaction) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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
