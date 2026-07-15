"use server";

import { createClient } from "@/utils/supabase/server";

export type QueueActionResult =
  | { success: true; isParticipating: boolean }
  | { success: false; error: string };

export type ActiveQueue = {
  queueId: string;
  targetId: string;
  targetType: "class" | "group";
};

/** Enriched queue data for the dashboard widget */
export type DetailedActiveQueue = {
  queueId: string;
  targetId: string;
  targetType: "class" | "group";
  targetName: string;
  pendingCount: number;
  participants: { id: string; name: string }[];
};

/**
 * Fetch all open queues where the current teacher is a participant.
 * Returns a list of { queueId, targetId, targetType } so the UI can
 * derive which toggles should be "on".
 */
export async function getMyActiveQueues(): Promise<ActiveQueue[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return [];

  // Fetch queues where this teacher participates and queue is open
  const { data, error } = await supabase
    .from("help_queue_participants")
    .select(
      `
      queue_id,
      active_help_queues!inner (
        id,
        class_id,
        student_group_id,
        status
      )
    `,
    )
    .eq("teacher_id", user.id)
    .eq("active_help_queues.status", "open");

  if (error || !data) return [];

  return data.map((row: any) => {
    const q = row.active_help_queues;
    return {
      queueId: q.id,
      targetId: q.class_id || q.student_group_id,
      targetType: q.class_id ? "class" : "group",
    };
  });
}

/**
 * Toggle the current teacher's participation in a help queue.
 *
 * Toggle ON:
 *   1. Find an existing 'open' queue for the target. If none, create one.
 *   2. Add the teacher to help_queue_participants.
 *
 * Toggle OFF:
 *   1. Remove the teacher from help_queue_participants for that queue.
 *   2. If no participants remain, set queue status to 'closed'.
 */
export async function toggleQueueParticipation(
  targetId: string,
  targetType: "class" | "group",
): Promise<QueueActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Ikke autentisert." };
  }

  const teacherId = user.id;
  const classCol = targetType === "class" ? "class_id" : "student_group_id";

  // ── Step 1: Find existing open queue for this target ──
  const { data: existingQueues, error: findError } = await supabase
    .from("active_help_queues")
    .select("id")
    .eq(classCol, targetId)
    .eq("status", "open")
    .limit(1);

  if (findError) {
    return { success: false, error: "Kunne ikke sjekke køstatus." };
  }

  const openQueue = existingQueues?.[0] ?? null;

  // ── Step 2: Check if this teacher is already participating ──
  if (openQueue) {
    const { data: existing } = await supabase
      .from("help_queue_participants")
      .select("queue_id")
      .eq("queue_id", openQueue.id)
      .eq("teacher_id", teacherId)
      .limit(1);

    const isCurrentlyParticipating = (existing?.length ?? 0) > 0;

    if (isCurrentlyParticipating) {
      // ── TOGGLE OFF: Remove participant ──
      const { error: removeError } = await supabase
        .from("help_queue_participants")
        .delete()
        .eq("queue_id", openQueue.id)
        .eq("teacher_id", teacherId);

      if (removeError) {
        return { success: false, error: "Kunne ikke forlate køen." };
      }

      // Check remaining participants
      const { count } = await supabase
        .from("help_queue_participants")
        .select("*", { count: "exact", head: true })
        .eq("queue_id", openQueue.id);

      if (count === 0) {
        // No participants left — close the queue
        await supabase
          .from("active_help_queues")
          .update({ status: "closed" })
          .eq("id", openQueue.id);
      }

      return { success: true, isParticipating: false };
    } else {
      // ── TOGGLE ON: Join existing queue ──
      const { error: joinError } = await supabase
        .from("help_queue_participants")
        .insert({ queue_id: openQueue.id, teacher_id: teacherId });

      if (joinError) {
        return { success: false, error: "Kunne ikke bli med i køen." };
      }

      return { success: true, isParticipating: true };
    }
  } else {
    // ── No open queue exists — create one and join ──
    const insertPayload: Record<string, string> =
      targetType === "class"
        ? { class_id: targetId }
        : { student_group_id: targetId };

    const { data: newQueue, error: createError } = await supabase
      .from("active_help_queues")
      .insert(insertPayload)
      .select("id")
      .single();

    if (createError || !newQueue) {
      return { success: false, error: "Kunne ikke opprette kø." };
    }

    const { error: joinError } = await supabase
      .from("help_queue_participants")
      .insert({ queue_id: newQueue.id, teacher_id: teacherId });

    if (joinError) {
      return { success: false, error: "Kø opprettet, men kunne ikke delta." };
    }

    return { success: true, isParticipating: true };
  }
}

/**
 * Fetch enriched data for all open queues the current teacher participates in.
 * Used by the dashboard widget.
 */
export async function getMyActiveQueuesDetailed(): Promise<
  DetailedActiveQueue[]
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return [];

  // 1. Get queues this teacher participates in
  const { data: participations, error: pErr } = await supabase
    .from("help_queue_participants")
    .select(
      `
      queue_id,
      active_help_queues!inner (
        id,
        class_id,
        student_group_id,
        status
      )
    `,
    )
    .eq("teacher_id", user.id)
    .eq("active_help_queues.status", "open");

  if (pErr || !participations || participations.length === 0) return [];

  const queues = participations.map((row: any) => {
    const q = row.active_help_queues;
    return {
      queueId: q.id as string,
      classId: q.class_id as string | null,
      groupId: q.student_group_id as string | null,
    };
  });

  const queueIds = queues.map((q) => q.queueId);
  const classIds = queues
    .filter((q) => q.classId)
    .map((q) => q.classId as string);
  const groupIds = queues
    .filter((q) => q.groupId)
    .map((q) => q.groupId as string);

  // 2. Fetch all participants for these queues (batch)
  const { data: allParticipants } = await supabase
    .from("help_queue_participants")
    .select("queue_id, teacher_id, profiles!inner(id, full_name)")
    .in("queue_id", queueIds);

  // 3. Fetch pending help request counts per queue
  const { data: pendingRequests } = await supabase
    .from("help_requests")
    .select("active_queue_id")
    .in("active_queue_id", queueIds)
    .eq("status", "pending");

  // 4. Fetch class names (batch)
  let classMap: Record<string, string> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    if (classes) {
      classMap = Object.fromEntries(classes.map((c: any) => [c.id, c.name]));
    }
  }

  // 5. Fetch group names (batch)
  let groupMap: Record<string, string> = {};
  if (groupIds.length > 0) {
    const { data: groups } = await supabase
      .from("student_groups")
      .select("id, name")
      .in("id", groupIds);
    if (groups) {
      groupMap = Object.fromEntries(groups.map((g: any) => [g.id, g.name]));
    }
  }

  // 6. Assemble enriched results
  const pendingCountMap: Record<string, number> = {};
  if (pendingRequests) {
    for (const r of pendingRequests) {
      const qid = r.active_queue_id;
      if (qid) pendingCountMap[qid] = (pendingCountMap[qid] ?? 0) + 1;
    }
  }

  const participantMap: Record<string, { id: string; name: string }[]> = {};
  if (allParticipants) {
    for (const p of allParticipants as any[]) {
      const qid = p.queue_id;
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      if (!participantMap[qid]) participantMap[qid] = [];
      participantMap[qid].push({
        id: profile.id,
        name: profile.full_name ?? "Ukjent",
      });
    }
  }

  return queues.map((q) => ({
    queueId: q.queueId,
    targetId: (q.classId || q.groupId) as string,
    targetType: (q.classId ? "class" : "group") as "class" | "group",
    targetName: q.classId
      ? (classMap[q.classId] ?? "Ukjent klasse")
      : (groupMap[q.groupId!] ?? "Ukjent gruppe"),
    pendingCount: pendingCountMap[q.queueId] ?? 0,
    participants: (participantMap[q.queueId] ?? []).filter(
      (p) => p.id !== user.id,
    ),
  }));
}
