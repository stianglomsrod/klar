"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { X, CheckCircle, GripVertical, Clock, HandHelping } from "lucide-react";
import { isImageUrl } from "@/utils/avatar";

// ── Types ──────────────────────────────────────────────
export type HelpQueueItem = {
  id: string;
  student_id: string;
  class_id: string;
  created_at: string;
  sort_order: number;
  full_name: string;
  avatar_url: string | null;
};

interface HelpQueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after resolving so parent can decrement the count */
  onResolved?: () => void;
}

// ── Helpers ────────────────────────────────────────────
function waitTimeLabel(createdAt: string): {
  text: string;
  color: string;
} {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return { text: "nå", color: "text-slate-500" };
  if (mins < 5) return { text: `${mins} min`, color: "text-slate-500" };
  if (mins < 10)
    return { text: `${mins} min`, color: "text-orange-600 font-medium" };

  const hours = Math.floor(mins / 60);
  if (hours >= 1)
    return {
      text: `${hours} time${hours > 1 ? "r" : ""}`,
      color: "text-red-600 font-bold",
    };
  return { text: `${mins} min`, color: "text-red-600 font-bold" };
}

// ── Component ──────────────────────────────────────────
export default function HelpQueueSheet({
  isOpen,
  onClose,
  onResolved,
}: HelpQueueSheetProps) {
  const [queue, setQueue] = useState<HelpQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const supabase = createClient();

  // ── Fetch queue ────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // RLS (can_access_student) scopes visibility per teacher/substitute
      const { data, error } = await supabase
        .from("help_requests")
        .select(
          `
          id,
          student_id,
          class_id,
          created_at,
          sort_order,
          profiles!student_id (
            full_name,
            avatar_url
          )
        `,
        )
        .eq("status", "pending")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      setQueue(
        (data || []).map(
          (r: {
            id: string;
            student_id: string;
            class_id: string;
            created_at: string;
            sort_order: number;
            profiles: { full_name: string; avatar_url: string | null } | null;
          }) => ({
            id: r.id,
            student_id: r.student_id,
            class_id: r.class_id,
            created_at: r.created_at,
            sort_order: r.sort_order ?? 0,
            full_name: r.profiles?.full_name || "Ukjent elev",
            avatar_url: r.profiles?.avatar_url ?? null,
          }),
        ),
      );
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isOpen) fetchQueue();
  }, [isOpen, fetchQueue]);

  // ── Real-time subscription ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel("help_queue_sheet")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        () => fetchQueue(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, supabase, fetchQueue]);

  // ── Drag end handler ───────────────────────────────
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;

    // Optimistic reorder
    const reordered = Array.from(queue);
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(destIdx, 0, moved);

    // Assign new sort_order values (0, 1, 2, …)
    const updated = reordered.map((item, i) => ({
      ...item,
      sort_order: i,
    }));
    setQueue(updated);

    // Persist to Supabase — batch update the changed items
    try {
      const minIdx = Math.min(srcIdx, destIdx);
      const maxIdx = Math.max(srcIdx, destIdx);
      const toUpdate = updated.slice(minIdx, maxIdx + 1);

      await Promise.all(
        toUpdate.map((item) =>
          supabase
            .from("help_requests")
            .update({ sort_order: item.sort_order })
            .eq("id", item.id),
        ),
      );
    } catch {
      // Revert on failure
      fetchQueue();
    }
  };

  // ── Resolve handler ────────────────────────────────
  const handleResolve = async (id: string) => {
    setResolvingId(id);
    // Optimistic removal
    setQueue((prev) => prev.filter((r) => r.id !== id));

    try {
      const { error } = await supabase
        .from("help_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      onResolved?.();
    } catch {
      // Revert — re-fetch on failure
      fetchQueue();
    } finally {
      setResolvingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100">
                  <HandHelping className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Hjelpekø
                  </h2>
                  <p className="text-xs text-slate-500">
                    {queue.length}{" "}
                    {queue.length === 1 ? "elev venter" : "elever venter"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <p className="text-sm text-slate-500">Laster hjelpekø…</p>
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <HandHelping className="h-10 w-10 text-slate-300" />
                  <p className="text-slate-500">
                    Ingen elever venter på hjelp.
                  </p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="help-queue">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2"
                      >
                        <AnimatePresence initial={false}>
                          {queue.map((item, index) => {
                            const wait = waitTimeLabel(item.created_at);
                            const initials = (item.full_name || "E")
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2);

                            return (
                              <Draggable
                                key={item.id}
                                draggableId={item.id}
                                index={index}
                              >
                                {(dragProvided, snapshot) => (
                                  <motion.div
                                    layout
                                    exit={{
                                      opacity: 0,
                                      x: 80,
                                      transition: { duration: 0.25 },
                                    }}
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-shadow ${
                                      snapshot.isDragging
                                        ? "border-blue-300 bg-blue-50 shadow-lg"
                                        : "border-slate-200 bg-white hover:shadow-sm"
                                    }`}
                                  >
                                    {/* Drag handle */}
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="shrink-0 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                                    >
                                      <GripVertical className="h-5 w-5" />
                                    </div>

                                    {/* Queue number */}
                                    <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                      {index + 1}
                                    </div>

                                    {/* Avatar */}
                                    <div className="shrink-0">
                                      {isImageUrl(item.avatar_url) ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={item.avatar_url}
                                          alt={item.full_name}
                                          className="w-8 h-8 rounded-full object-cover"
                                        />
                                      ) : item.avatar_url ? (
                                        <div className="flex items-center justify-center w-8 h-8 text-lg">
                                          {item.avatar_url}
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                                          {initials}
                                        </div>
                                      )}
                                    </div>

                                    {/* Name + wait time */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {item.full_name}
                                      </p>
                                      <p
                                        className={`flex items-center gap-1 text-xs ${wait.color}`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        ventet {wait.text}
                                      </p>
                                    </div>

                                    {/* Resolve button */}
                                    <button
                                      onClick={() => handleResolve(item.id)}
                                      disabled={resolvingId === item.id}
                                      className="shrink-0 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                      title="Merk som ferdig"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Ferdig
                                    </button>
                                  </motion.div>
                                )}
                              </Draggable>
                            );
                          })}
                        </AnimatePresence>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>

            {/* Footer hint */}
            {!loading && queue.length > 1 && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
                <p className="text-xs text-slate-400 text-center">
                  Dra og slipp for å endre rekkefølgen
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
