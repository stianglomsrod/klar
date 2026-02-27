"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type ForwardedRef,
} from "react";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";

export type AudioRecorderHandle = {
  /** If currently recording, stops and returns a Promise that resolves with the blob.
   *  If not recording, resolves with null immediately. */
  stopAndFinalize: () => Promise<Blob | null>;
  /** Whether the recorder is currently recording */
  isRecording: boolean;
};

type AudioRecorderProps = {
  /** Called with the recorded blob when recording stops */
  onRecorded: (blob: Blob) => void;
  /** Called when the recording is removed */
  onRemove: () => void;
  /** Whether a recording already exists */
  hasRecording: boolean;
  /** URL for playback if a recording exists */
  audioUrl?: string;
  /** Compact mode for quiz per-question layout */
  compact?: boolean;
};

const AudioRecorder = forwardRef(function AudioRecorder(
  {
    onRecorded,
    onRemove,
    hasRecording,
    audioUrl,
    compact = false,
  }: AudioRecorderProps,
  ref: ForwardedRef<AudioRecorderHandle>,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        onRecorded(blob);
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      // Mic permission denied — browser shows its own permission dialog
    }
  }, [onRecorded]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Imperative handle: lets parent stop recording and await the resulting blob
  useImperativeHandle(
    ref,
    () => ({
      stopAndFinalize: () => {
        if (
          !mediaRecorderRef.current ||
          mediaRecorderRef.current.state !== "recording"
        ) {
          return Promise.resolve(null);
        }
        return new Promise<Blob | null>((resolve) => {
          const recorder = mediaRecorderRef.current!;
          const originalOnStop = recorder.onstop;
          recorder.onstop = (ev) => {
            // Build the blob from chunks
            const blob = new Blob(chunksRef.current, {
              type: recorder.mimeType,
            });
            // Call the original handler (which invokes onRecorded + stops tracks)
            if (originalOnStop) originalOnStop.call(recorder, ev);
            resolve(blob);
          };
          stopRecording();
        });
      },
      get isRecording() {
        return isRecording;
      },
    }),
    [stopRecording, isRecording],
  );

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  const handleRemove = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setElapsed(0);
    onRemove();
  }, [onRemove]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Recording state ──
  if (isRecording) {
    return (
      <div
        className={`flex items-center gap-3 ${compact ? "px-3 py-2" : "px-4 py-3"} bg-red-50 border border-red-200 rounded-2xl`}
      >
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-700 font-semibold text-sm tabular-nums">
          {formatTime(elapsed)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={stopRecording}
          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Playback state (has recording) ──
  if (hasRecording && audioUrl) {
    return (
      <div
        className={`flex items-center gap-3 ${compact ? "px-3 py-2" : "px-4 py-3"} bg-emerald-50 border border-emerald-200 rounded-2xl`}
      >
        <button
          type="button"
          onClick={togglePlayback}
          className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full transition-colors"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <span className="text-emerald-700 text-sm font-medium">
          Lydopptak klart
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleRemove}
          className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Idle state (no recording) ──
  return (
    <button
      type="button"
      onClick={startRecording}
      className={`flex items-center gap-2 ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"} text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl border border-gray-200 hover:border-indigo-200 transition-all`}
    >
      <Mic className={compact ? "h-4 w-4" : "h-5 w-5"} />
      <span className="font-medium">
        {compact ? "Svar med lyd" : "Ta opp lyd"}
      </span>
    </button>
  );
});

export default AudioRecorder;
