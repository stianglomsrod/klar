"use client";

import CompletionModal from "@/components/CompletionModal";
import LevelUpModal from "@/components/LevelUpModal";
import HalfwayModal from "@/components/HalfwayModal";
import StudentQuizView from "@/components/student/StudentQuizView";
import MediaUploadToolbar from "@/components/ui/MediaUploadToolbar";
import Toast from "@/components/ui/Toast";
import type { MediaUploadToolbarHandle } from "@/components/ui/MediaUploadToolbar";
import type { StudentProfile } from "@/contexts/StudentProfileContext";
import type { StudentTask } from "@/types/shared";
import type { ToastState } from "@/hooks/useToast";
import type {
  QuizResponses,
  QuizAudioBlobs,
} from "@/components/student/StudentQuizView";

// ── Types ────────────────────────────────────────────

type TaskFlowModalsProps = {
  // Profile — source of truth for modal display data
  profile: StudentProfile | null;

  // CompletionModal + MediaUploadToolbar
  isModalOpen: boolean;
  closeCompletionModal: () => void;
  handleConfirmCompletion: () => Promise<void>;
  handleBeforeConfirm: () => Promise<void>;
  mediaToolbarRef: React.RefObject<MediaUploadToolbarHandle | null>;
  mediaImage: File | null;
  setMediaImage: (file: File | null) => void;
  mediaAudioBlob: Blob | null;
  mediaAudioUrl: string | undefined;
  handleAudioRecorded: (blob: Blob) => void;
  handleAudioRemove: () => void;

  // StudentQuizView
  isQuizOpen: boolean;
  quizTask: StudentTask | null;
  closeQuiz: () => void;
  handleQuizSubmit: (
    responses: QuizResponses,
    audioBlobs: QuizAudioBlobs,
  ) => Promise<void>;

  // LevelUpModal
  showLevelUpModal: boolean;
  newLevel: number;
  closeLevelUpModal: () => void;
  handleRewardSelection: (
    rewardType: "petal" | "database",
    payload?: string,
    petalIndex?: number,
    rewardId?: string,
  ) => void;

  // HalfwayModal — page-specific data
  showHalfwayModal: boolean;
  closeHalfwayModal: () => void;
  incompleteTasks: StudentTask[];
  subjectContext?: { id: string; title: string };

  // Toast
  toast: ToastState;
  hideToast: () => void;
};

// ── Component ────────────────────────────────────────

/**
 * Shared modal stack rendered by both Container A (`subject/[id]`)
 * and Container B (`lesson/[id]`).
 *
 * Renders: CompletionModal → StudentQuizView → LevelUpModal → HalfwayModal → Toast
 *
 * Extracted to eliminate duplication — both pages previously copied
 * this identical ~70-line block.
 */
export default function TaskFlowModals({
  profile,
  isModalOpen,
  closeCompletionModal,
  handleConfirmCompletion,
  handleBeforeConfirm,
  mediaToolbarRef,
  mediaImage,
  setMediaImage,
  mediaAudioBlob,
  mediaAudioUrl,
  handleAudioRecorded,
  handleAudioRemove,
  isQuizOpen,
  quizTask,
  closeQuiz,
  handleQuizSubmit,
  showLevelUpModal,
  newLevel,
  closeLevelUpModal,
  handleRewardSelection,
  showHalfwayModal,
  closeHalfwayModal,
  incompleteTasks,
  subjectContext,
  toast,
  hideToast,
}: TaskFlowModalsProps) {
  return (
    <>
      {/* Completion Modal */}
      <CompletionModal
        isOpen={isModalOpen}
        onClose={closeCompletionModal}
        onConfirm={handleConfirmCompletion}
        onBeforeConfirm={handleBeforeConfirm}
        avatarUrl={profile?.avatar_url}
      >
        <MediaUploadToolbar
          ref={mediaToolbarRef}
          onImageChange={setMediaImage}
          onAudioRecorded={handleAudioRecorded}
          onAudioRemove={handleAudioRemove}
          hasAudio={!!mediaAudioBlob}
          audioUrl={mediaAudioUrl}
          imageFile={mediaImage}
        />
      </CompletionModal>

      {/* Student Quiz View */}
      {quizTask && quizTask.quiz_data && (
        <StudentQuizView
          isOpen={isQuizOpen}
          questions={quizTask.quiz_data}
          taskTitle={quizTask.title}
          onClose={closeQuiz}
          onSubmit={handleQuizSubmit}
        />
      )}

      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUpModal}
        newLevel={newLevel}
        onClose={closeLevelUpModal}
        onSelectReward={handleRewardSelection}
        existingPetals={profile?.petals_progress || 0}
        existingColors={profile?.petal_colors || []}
        showFlowerGarden={profile?.show_flower_garden || false}
        studentId={profile?.id}
      />

      {/* Halfway Celebration Modal */}
      <HalfwayModal
        isOpen={showHalfwayModal}
        onClose={closeHalfwayModal}
        currentXp={profile?.current_xp ?? 0}
        goalTotal={profile?.current_goal_total ?? 100}
        level={profile?.level ?? 1}
        studentId={profile?.id ?? ""}
        showFlowerGarden={profile?.show_flower_garden ?? false}
        incompleteTasks={incompleteTasks}
        subjectContext={subjectContext}
      />

      <Toast toast={toast} onClose={hideToast} />
    </>
  );
}
