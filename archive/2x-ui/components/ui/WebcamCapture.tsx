"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, RotateCcw, Check } from "lucide-react";

type WebcamCaptureProps = {
  isOpen: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
};

/**
 * Full-screen webcam overlay for desktop users.
 * Opens the camera stream, lets the user snap a photo, preview, and confirm.
 */
export default function WebcamCapture({
  isOpen,
  onCapture,
  onClose,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Start / stop camera stream
  useEffect(() => {
    if (!isOpen) {
      // Cleanup when closing
      stopStream();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (!cancelled) {
          setError(
            "Kunne ikke åpne kameraet. Sjekk tillatelsene i nettleseren.",
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isOpen]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSnap = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);
  }, []);

  const handleRetake = useCallback(() => {
    setPreview(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `webcam_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
          onClose();
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [onCapture, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <h2 className="text-white font-semibold text-base">Ta bilde</h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Video / Preview area */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
            {error ? (
              <div className="text-center px-6">
                <p className="text-white/80 text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors"
                >
                  Lukk
                </button>
              </div>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Forhåndsvisning"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* Controls */}
          {!error && (
            <div className="flex items-center justify-center gap-6 px-4 py-6 bg-black/80">
              {preview ? (
                <>
                  <button
                    onClick={handleRetake}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-colors"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Ta nytt bilde
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-md"
                  >
                    <Check className="h-5 w-5" />
                    Bruk bilde
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSnap}
                  className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-colors active:scale-95"
                >
                  <Camera className="h-7 w-7 text-gray-800" />
                </button>
              )}
            </div>
          )}

          {/* Hidden canvas for snapshot */}
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
