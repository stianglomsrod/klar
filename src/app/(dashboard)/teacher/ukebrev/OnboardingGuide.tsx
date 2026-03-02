"use client";

import { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  FileCheck,
  Search,
  ShieldCheck,
  Rocket,
} from "lucide-react";

// ── Self-contained onboarding guide for the AI planner ──

export default function OnboardingGuide() {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowGuide((prev) => !prev)}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors group"
      >
        <Sparkles className="h-4 w-4" />
        <span>Slik fungerer AI-planleggeren</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${showGuide ? "rotate-180" : ""}`}
        />
      </button>

      {showGuide && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Card 1 — Two document types */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">
                To dokumenttyper
              </h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              AI-en gjenkjenner automatisk om filen er et{" "}
              <strong>ukebrev</strong> (med beskjeder, læringsmål, lekser og
              timeplan) eller en <strong>undervisningsplan</strong> (med økter,
              oppgaver og mål per fag). Du trenger bare å laste opp — resten
              ordner vi.
            </p>
          </div>

          {/* Card 2 — What the AI extracts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Search className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">
                Hva AI-en ser etter
              </h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              AI-en leser dokumentet og henter ut <strong>ukedager</strong>,{" "}
              <strong>fag</strong>, <strong>klokkeslett</strong>,{" "}
              <strong>oppgaver</strong> og <strong>beskjeder</strong>. Den
              forstår også forkortelser som «nor», «matte» og «k&h», og
              håndterer kombinasjonsfag som «Nor/Bib» automatisk.
            </p>
          </div>

          {/* Card 3 — Smart filtering */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">
                Smart filtrering
              </h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dokumentet trenger <strong>ikke</strong> å være perfekt
              formatert. Inneholder det ekstra tekst, overskrifter, bilder
              eller annen informasjon som ikke er relevant, filtrerer AI-en
              bort støyen og trekker kun ut det som er nødvendig. Bare last opp
              som det er!
            </p>
          </div>

          {/* Card 4 — What happens on save */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
                <Rocket className="h-5 w-5 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">
                Hva skjer når du lagrer?
              </h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              For <strong>ukebrev</strong>: Timeplaner oppdateres for valgte
              klasser, og beskjeder lagres som ukens informasjon. For{" "}
              <strong>undervisningsplaner</strong>: Oppgaver opprettes
              automatisk for hver elev og kobles til riktig time i timeplanen.
              Du får alltid se en forhåndsvisning og kan redigere før du
              lagrer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
