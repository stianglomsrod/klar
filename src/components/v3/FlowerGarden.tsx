"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Flower2 } from "lucide-react";
import { claimOwnFlowerRewardAction } from "@/app/actions/v3/reward-actions";
import { createClientUuid } from "@/lib/client-uuid";
import {
  FLOWER_REWARD_COLORS,
  FLOWER_REWARD_PRESENTATION,
  type FlowerRewardClaim,
  type FlowerRewardProjection,
} from "@/lib/flower-rewards";
import type { FlowerRewardColor } from "@/server/supabase/database.types";
import { StudentFlower } from "./StudentFlower";

function groupClaimsByFlower(claims: FlowerRewardClaim[]) {
  const grouped = new Map<number, FlowerRewardClaim[]>();
  for (const claim of claims) {
    const current = grouped.get(claim.flowerNumber) ?? [];
    current.push(claim);
    grouped.set(claim.flowerNumber, current);
  }
  return grouped;
}

function nextVisibleFlowerNumber(claims: FlowerRewardClaim[]): number {
  if (claims.length === 0) return 1;
  const last = claims[claims.length - 1];
  return last.petalNumber === 5 ? last.flowerNumber + 1 : last.flowerNumber;
}

export function FlowerGarden({
  initialProjection,
}: {
  initialProjection: FlowerRewardProjection;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [claims, setClaims] = useState(initialProjection.claims);
  const [available, setAvailable] = useState(
    initialProjection.availableEntitlements,
  );
  const [selectedColor, setSelectedColor] =
    useState<FlowerRewardColor | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const resultRef = useRef<HTMLParagraphElement>(null);
  const pending = available[0] ?? null;
  const grouped = groupClaimsByFlower(claims);
  const visibleFlowerNumbers = [...grouped.keys()];
  if (pending) {
    const current = nextVisibleFlowerNumber(claims);
    if (!visibleFlowerNumbers.includes(current)) visibleFlowerNumbers.push(current);
  }
  visibleFlowerNumbers.sort((first, second) => first - second);
  const choiceHeading = pending
    ? "Velg et kronblad"
    : claims.length === 0
      ? "Ingen kronblader ennå"
      : "Alle opptjente kronblad er valgt";

  useEffect(() => {
    if (!message) return;
    const frame = window.requestAnimationFrame(() => resultRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [message]);

  function chooseColor(color: FlowerRewardColor) {
    setSelectedColor(color);
    setError(null);
    setMessage(null);
  }

  async function claimPetal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || !selectedColor || saving) return;

    const requestKey = `${pending.entitlementId}:${selectedColor}`;
    const requestId = requestIds.current.get(requestKey) ?? createClientUuid();
    requestIds.current.set(requestKey, requestId);
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await claimOwnFlowerRewardAction({
        entitlementId: pending.entitlementId,
        requestId,
        flowerColor: selectedColor,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }

      requestIds.current.delete(requestKey);
      setClaims((current) =>
        [...current, result.claim].sort(
          (first, second) =>
            first.collectionSequence - second.collectionSequence,
        ),
      );
      setAvailable((current) =>
        current.filter(
          (entitlement) =>
            entitlement.entitlementId !== result.claim.entitlementId,
        ),
      );
      setSelectedColor(null);
      setMessage(
        result.claim.petalNumber === 5
          ? "Blomsten er ferdig. Godt jobbet!"
          : "Kronbladet er lagt til i blomsterhagen.",
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Kunne ikke lagre kronbladet akkurat nå. Prøv igjen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.4fr)] lg:items-start">
      <section
        aria-labelledby="flower-choice-heading"
        className="rounded-[2rem] border border-pink-200 bg-gradient-to-br from-white via-rose-50 to-orange-50 p-5 shadow-sm sm:p-7"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-pink-100 text-pink-700">
            <Flower2 aria-hidden="true" className="h-7 w-7" />
          </span>
          <div>
            <h2 id="flower-choice-heading" className="text-2xl font-black">
              {choiceHeading}
            </h2>
            <p className="mt-2 leading-6 text-slate-600">
              {pending
                ? `Du fikk et kronblad da du nådde nivå ${pending.level}. Velg en farge nå, eller kom tilbake senere.`
                : claims.length === 0
                  ? "Det første kronbladet kommer når du når et nytt nivå for første gang."
                  : "Det kommer et nytt kronblad neste gang du når et nytt nivå for første gang."}
            </p>
          </div>
        </div>

        {pending && (
          <form onSubmit={claimPetal} className="mt-6">
            <fieldset disabled={saving}>
              <legend className="font-bold">Velg farge</legend>
              <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4 lg:grid-cols-2">
                {FLOWER_REWARD_COLORS.map((color) => {
                  const presentation = FLOWER_REWARD_PRESENTATION[color];
                  const selected = selectedColor === color;
                  return (
                    <label
                      key={color}
                      className={`relative flex min-h-14 cursor-pointer items-center gap-2 rounded-2xl border bg-white px-3 py-2 font-bold focus-within:ring-2 focus-within:ring-pink-700 focus-within:ring-offset-2 ${
                        selected
                          ? "border-pink-700 shadow-sm"
                          : "border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="flower-color"
                        value={color}
                        checked={selected}
                        onChange={() => chooseColor(color)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="h-7 w-7 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.22)]"
                        style={{ backgroundColor: presentation.color }}
                      />
                      <span>{presentation.label}</span>
                      {selected && (
                        <Check
                          aria-hidden="true"
                          className="ml-auto h-5 w-5 text-pink-800"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <button
              type="submit"
              disabled={!selectedColor || saving}
              className="mt-5 min-h-12 w-full rounded-2xl bg-pink-700 px-5 py-3 font-black text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
            >
              {saving ? "Lagrer …" : "Legg til kronblad"}
            </button>
          </form>
        )}

        <div aria-live="polite" aria-atomic="true">
          {error && (
            <p role="alert" className="mt-4 font-semibold text-red-800">
              {error}
            </p>
          )}
          {message && (
            <p
              ref={resultRef}
              tabIndex={-1}
              className="mt-4 rounded-xl font-bold text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              {message}
            </p>
          )}
          {isRefreshing && <span className="sr-only">Oppdaterer hagen</span>}
        </div>
      </section>

      <section
        aria-labelledby="garden-heading"
        className="rounded-[2rem] border border-emerald-200 bg-gradient-to-b from-sky-50 to-emerald-50 p-5 shadow-sm sm:p-7"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="garden-heading" className="text-2xl font-black">
              Hagen min
            </h2>
            <p className="mt-2 text-slate-600">
              Hvert kronblad viser noe du har fått til.
            </p>
          </div>
          {claims.length > 0 && (
            <p className="shrink-0 rounded-full bg-white/85 px-3 py-1.5 text-sm font-bold text-emerald-900">
              {claims.length} {claims.length === 1 ? "kronblad" : "kronblader"}
            </p>
          )}
        </div>

        {visibleFlowerNumbers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-white/75 p-6 text-center">
            <Flower2 aria-hidden="true" className="mx-auto h-12 w-12 text-emerald-700" />
            <p className="mt-3 font-bold">Hagen er klar for det første kronbladet.</p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {visibleFlowerNumbers.map((flowerNumber) => {
              const flowerClaims = grouped.get(flowerNumber) ?? [];
              return (
                <li
                  key={flowerNumber}
                  className="rounded-3xl border border-white/90 bg-white/80 p-3 text-center shadow-sm"
                >
                  <StudentFlower
                    flowerNumber={flowerNumber}
                    claims={flowerClaims}
                    className="mx-auto w-full max-w-40"
                  />
                  <h3 className="font-black">Blomst {flowerNumber}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {flowerClaims.length} av 5 kronblader
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
