"use client";

import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";

export function StudentReadAloudButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleSpeech() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return;
    }
    const synth = window.speechSynthesis;

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nb-NO";
    const norwegianVoice = synth
      .getVoices()
      .find((voice) => /^(nb|nn|no)(-|_)/i.test(voice.lang));
    if (norwegianVoice) utterance.voice = norwegianVoice;
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={toggleSpeech}
      aria-pressed={isSpeaking}
      aria-label={isSpeaking ? "Stopp opplesing" : "Les opp oppgaven"}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
    >
      {isSpeaking ? (
        <Square aria-hidden="true" className="h-4 w-4 fill-current" />
      ) : (
        <Volume2 aria-hidden="true" className="h-5 w-5" />
      )}
      {isSpeaking ? "Stopp" : "Les opp"}
    </button>
  );
}
