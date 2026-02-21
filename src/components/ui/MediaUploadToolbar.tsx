"use client";

import {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  type ForwardedRef,
} from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import AudioRecorder, {
  type AudioRecorderHandle,
} from "@/components/ui/AudioRecorder";
import WebcamCapture from "@/components/ui/WebcamCapture";

export type MediaUploadToolbarHandle = {
  /** Stops any active audio recording and returns the blob (or null). */
  stopRecordingIfActive: () => Promise<Blob | null>;
  /** Whether the audio recorder is currently recording */
  isRecording: boolean;
};

type MediaUploadToolbarProps = {
  /** Called when the image file changes (or null to clear) */
  onImageChange: (file: File | null) => void;
  /** Called when an audio blob is recorded */
  onAudioRecorded: (blob: Blob) => void;
  /** Called when audio is removed */
  onAudioRemove: () => void;
  /** Whether an audio recording exists */
  hasAudio: boolean;
  /** Object URL for audio playback */
  audioUrl?: string;
  /** Existing image file for preview */
  imageFile?: File | null;
};

/** Detect if the device is a "touch" device (mobile/tablet) vs desktop */
function useIsTouchDevice() {
  const [isTouch] = useState(() => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  });
  return isTouch;
}

const MediaUploadToolbar = forwardRef(function MediaUploadToolbar(
  {
    onImageChange,
    onAudioRecorded,
    onAudioRemove,
    hasAudio,
    audioUrl,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    imageFile,
  }: MediaUploadToolbarProps,
  ref: ForwardedRef<MediaUploadToolbarHandle>,
) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);
  const isTouch = useIsTouchDevice();

  // Expose imperative handle to parent
  useImperativeHandle(
    ref,
    () => ({
      stopRecordingIfActive: () =>
        audioRecorderRef.current?.stopAndFinalize() ?? Promise.resolve(null),
      get isRecording() {
        return audioRecorderRef.current?.isRecording ?? false;
      },
    }),
    [],
  );

  const handleImageSelected = (file: File | null) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      onImageChange(file);
    }
  };

  const handleCameraClick = () => {
    if (isTouch) {
      // Mobile/tablet: use native camera via file input
      cameraInputRef.current?.click();
    } else {
      // Desktop: open webcam overlay
      setWebcamOpen(true);
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    onImageChange(null);
  };

  return (
    <div className="space-y-3">
      {/* Image preview */}
      {imagePreview && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Vedlegg"
            className="h-24 w-24 object-cover rounded-xl border-2 border-gray-200 shadow-sm"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* All media buttons in a single row when idle (no active recording/playback) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Audio recorder (renders as a small button when idle) */}
        <AudioRecorder
          ref={audioRecorderRef}
          onRecorded={onAudioRecorded}
          onRemove={onAudioRemove}
          hasRecording={hasAudio}
          audioUrl={audioUrl}
        />

        {/* Camera + Gallery (hide when image already selected) */}
        {!imagePreview && (
          <>
            <button
              type="button"
              onClick={handleCameraClick}
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl border border-gray-200 hover:border-indigo-200 transition-all"
            >
              <Camera className="h-5 w-5" />
              <span className="font-medium">Kamera</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl border border-gray-200 hover:border-indigo-200 transition-all"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="font-medium">Bilde</span>
            </button>
          </>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageSelected(e.target.files?.[0] || null)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageSelected(e.target.files?.[0] || null)}
      />

      {/* Desktop webcam overlay — key forces remount to reset state each time */}
      {webcamOpen && (
        <WebcamCapture
          isOpen={webcamOpen}
          onCapture={(file) => handleImageSelected(file)}
          onClose={() => setWebcamOpen(false)}
        />
      )}
    </div>
  );
});

export default MediaUploadToolbar;
