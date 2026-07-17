"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { uploadStudentMedia } from "@/utils/supabase/storage";
import type { MediaUploadToolbarHandle } from "@/components/ui/MediaUploadToolbar";
import type { StudentTask } from "@/types/shared";
import type {
  QuizResponses,
  QuizAudioBlobs,
} from "@/components/student/StudentQuizView";

// ── Options ──────────────────────────────────────────

export interface UseTaskFlowOptions {
  /** Current task list (used for quiz lookup and standard completion). */
  tasks: StudentTask[];
  /**
   * Called after a task is successfully completed.
   * Each container implements its own optimistic UI update here.
   */
  onTaskCompleted: (taskId: string) => void;
  /** Toast notification function from the consuming component. */
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
}

// ── Hook ─────────────────────────────────────────────

/**
 * Encapsulates the shared task-submission flow used by both
 * Container A (`subject/[id]`) and Container B (`lesson/[id]`).
 *
 * Manages:
 * - Media attachment state (image, audio blob/URL)
 * - Completion modal state (selectedTaskId, isModalOpen)
 * - Quiz modal state (isQuizOpen, quizTask)
 * - Level-up modal state (showLevelUpModal, newLevel)
 * - Standard task completion (media upload → feedback upsert → XP)
 * - Quiz submission (per-question audio upload → feedback upsert → XP)
 * - Reward selection delegation
 *
 * Does NOT manage: data fetching, archive/undo, or rendering.
 */
export function useTaskFlow({
  tasks,
  onTaskCompleted,
  showToast,
}: UseTaskFlowOptions) {
  // ── useTaskCompletion (XP, leveling, sound, profile) ──
  const { profile, isCompleting, completeTask, undoTask, selectReward } =
    useTaskCompletion();

  // ── Media attachment state ─────────────────────────
  const mediaToolbarRef = useRef<MediaUploadToolbarHandle>(null);
  const [mediaImage, setMediaImage] = useState<File | null>(null);
  const [mediaAudioBlob, setMediaAudioBlob] = useState<Blob | null>(null);
  const [mediaAudioUrl, setMediaAudioUrl] = useState<string | undefined>(
    undefined,
  );

  const handleAudioRecorded = useCallback((blob: Blob) => {
    setMediaAudioBlob(blob);
    setMediaAudioUrl(URL.createObjectURL(blob));
  }, []);

  const handleAudioRemove = useCallback(() => {
    if (mediaAudioUrl) URL.revokeObjectURL(mediaAudioUrl);
    setMediaAudioBlob(null);
    setMediaAudioUrl(undefined);
  }, [mediaAudioUrl]);

  const clearMedia = useCallback(() => {
    setMediaImage(null);
    if (mediaAudioUrl) URL.revokeObjectURL(mediaAudioUrl);
    setMediaAudioBlob(null);
    setMediaAudioUrl(undefined);
  }, [mediaAudioUrl]);

  // ── Modal state ────────────────────────────────────
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // ── Halfway modal state ────────────────────────────
  const [showHalfwayModal, setShowHalfwayModal] = useState(false);

  // ── Quiz state ─────────────────────────────────────
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizTask, setQuizTask] = useState<StudentTask | null>(null);

  // ── Routing: quiz vs standard ──────────────────────
  const handleTaskComplete = useCallback((task: StudentTask) => {
    if (task.type === "quiz" && task.quiz_data && task.quiz_data.length > 0) {
      setQuizTask(task);
      setIsQuizOpen(true);
    } else {
      setSelectedTaskId(task.id);
      setIsModalOpen(true);
    }
  }, []);

  // ── Standard task completion ───────────────────────
  const handleConfirmCompletion = useCallback(async () => {
    if (!selectedTaskId) return;
    if (!profile) {
      showToast("Kunne ikke lagre: Fant ikke brukerprofilen.", "error");
      return;
    }

    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    try {
      // 1. Upload media attachments (if any) before completing
      if (mediaImage || mediaAudioBlob) {
        const supabase = createClient();
        let imageUrl: string | null = null;
        let audioUrl: string | null = null;

        if (mediaImage) {
          imageUrl = await uploadStudentMedia(
            mediaImage,
            profile.id,
            selectedTaskId,
            "image",
          );
        }
        if (mediaAudioBlob) {
          audioUrl = await uploadStudentMedia(
            mediaAudioBlob,
            profile.id,
            selectedTaskId,
            "audio",
          );
        }

        await supabase.from("feedback").upsert(
          {
            task_id: selectedTaskId,
            student_id: profile.id,
            student_image_url: imageUrl,
            student_audio_url: audioUrl,
          },
          { onConflict: "task_id" },
        );
      }

      // 2. Complete task via hook (marks done, XP, level, sound)
      const result = await completeTask(selectedTaskId, task.points_value, {
        studentName: profile.full_name ?? undefined,
        taskTitle: task.title,
      });

      // 3. Optimistic UI update (delegated to consumer)
      onTaskCompleted(selectedTaskId);

      // 4. Close modal & clear media
      setIsModalOpen(false);
      setSelectedTaskId(null);
      clearMedia();

      // 5. Level up modal if needed
      if (result?.shouldLevelUp && result.isNewHighLevel) {
        setNewLevel(result.newLevel);
        setShowLevelUpModal(true);
      } else if (result?.crossedHalfway) {
        setShowHalfwayModal(true);
      }
    } catch {
      showToast("Noe gikk galt. Prøv igjen.", "error");
    }
  }, [
    selectedTaskId,
    profile,
    tasks,
    mediaImage,
    mediaAudioBlob,
    completeTask,
    onTaskCompleted,
    clearMedia,
    showToast,
  ]);

  // ── Quiz submission ────────────────────────────────
  const handleQuizSubmit = useCallback(
    async (responses: QuizResponses, audioBlobs: QuizAudioBlobs) => {
      if (!quizTask) return;
      if (!profile) {
        showToast("Kunne ikke lagre: Fant ikke brukerprofilen.", "error");
        return;
      }

      const supabase = createClient();

      try {
        // 1. Upload per-question audio blobs and build enriched payload
        const enrichedResponses: Record<
          string,
          { answer: string | string[]; audioUrl?: string }
        > = {};

        for (const [qId, answer] of Object.entries(responses)) {
          const entry: { answer: string | string[]; audioUrl?: string } = {
            answer,
          };

          if (audioBlobs[qId]) {
            const audioUrl = await uploadStudentMedia(
              audioBlobs[qId],
              profile.id,
              quizTask.id,
              "audio",
            );
            entry.audioUrl = audioUrl;
          }

          enrichedResponses[qId] = entry;
        }

        // Also upload audio for questions that have audio but no text answer
        for (const [qId, blob] of Object.entries(audioBlobs)) {
          if (!enrichedResponses[qId]) {
            const audioUrl = await uploadStudentMedia(
              blob,
              profile.id,
              quizTask.id,
              "audio",
            );
            enrichedResponses[qId] = { answer: "", audioUrl };
          }
        }

        // 2. Upsert feedback with quiz_responses
        const { error: feedbackError } = await supabase.from("feedback").upsert(
          {
            task_id: quizTask.id,
            student_id: profile.id,
            quiz_responses: enrichedResponses,
          },
          { onConflict: "task_id" },
        );

        if (feedbackError) {
          throw new Error(feedbackError.message || "Feedback upsert failed");
        }

        // 3. Complete task via hook (marks done, XP, level, sound)
        const result = await completeTask(quizTask.id, quizTask.points_value, {
          studentName: profile.full_name ?? undefined,
          taskTitle: quizTask.title,
        });

        // 4. Optimistic UI update (delegated to consumer)
        onTaskCompleted(quizTask.id);

        // 5. Close quiz
        setIsQuizOpen(false);
        setQuizTask(null);

        // 6. Level up modal if needed
        if (result?.shouldLevelUp && result.isNewHighLevel) {
          setNewLevel(result.newLevel);
          setShowLevelUpModal(true);
        } else if (result?.crossedHalfway) {
          setShowHalfwayModal(true);
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : JSON.stringify(error);
        void msg;
        showToast(
          "Noe gikk galt ved lagring av svarene dine. Prøv igjen.",
          "error",
        );
      }
    },
    [quizTask, profile, completeTask, onTaskCompleted, showToast],
  );

  // ── Reward selection ───────────────────────────────
  const handleRewardSelection = useCallback(
    async (
      rewardType: "petal" | "database",
      payload?: string,
      petalIndex?: number,
      rewardId?: string,
    ) => {
      // Pass the pending level so selectReward clears it from the array
      const result = await selectReward(
        rewardType,
        payload,
        petalIndex,
        rewardId,
        newLevel, // forLevel — the level being rewarded
      );
      if (result.success) {
        setShowLevelUpModal(false);
      }
    },
    [selectReward, newLevel],
  );

  // ── CompletionModal onBeforeConfirm ────────────────
  const handleBeforeConfirm = useCallback(async () => {
    // If student is still recording, auto-stop and wait for the blob
    const blob = await mediaToolbarRef.current?.stopRecordingIfActive();
    if (blob) {
      // The AudioRecorder's onRecorded callback will have already fired via
      // the onstop handler, updating mediaAudioBlob in parent state.
      // Small delay to let React state settle.
      await new Promise((r) => setTimeout(r, 50));
    }
  }, []);

  // ── Modal close helpers ────────────────────────────
  const closeCompletionModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTaskId(null);
    clearMedia();
  }, [clearMedia]);

  const closeQuiz = useCallback(() => {
    setIsQuizOpen(false);
    setQuizTask(null);
  }, []);

  const closeLevelUpModal = useCallback(() => {
    setShowLevelUpModal(false);
  }, []);

  const closeHalfwayModal = useCallback(() => {
    setShowHalfwayModal(false);
  }, []);

  // ── Return ─────────────────────────────────────────
  return {
    // From useTaskCompletion (pass-through)
    profile,
    isCompleting,
    undoTask,

    // Media state
    mediaToolbarRef,
    mediaImage,
    setMediaImage,
    mediaAudioBlob,
    mediaAudioUrl,
    handleAudioRecorded,
    handleAudioRemove,
    clearMedia,

    // Modal state
    selectedTaskId,
    isModalOpen,
    showLevelUpModal,
    newLevel,
    showHalfwayModal,

    // Quiz state
    isQuizOpen,
    quizTask,

    // Handlers
    handleTaskComplete,
    handleConfirmCompletion,
    handleQuizSubmit,
    handleRewardSelection,
    handleBeforeConfirm,

    // Modal close helpers
    closeCompletionModal,
    closeQuiz,
    closeLevelUpModal,
    closeHalfwayModal,
  };
}
