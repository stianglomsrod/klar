"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Hook for browser-native Text-to-Speech via the Web Speech API.
 * Always speaks in Norwegian Bokmål (nb-NO / no-NO).
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    // If already speaking, stop first
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nb-NO";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    // Try to find a Norwegian voice
    const voices = window.speechSynthesis.getVoices();
    const norwegianVoice = voices.find(
      (v) => v.lang.startsWith("nb") || v.lang.startsWith("no"),
    );
    if (norwegianVoice) {
      utterance.voice = norwegianVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
