"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import FlowerPot from "@/components/FlowerPot";

type Profile = {
  petals_progress: number;
  flowers_collected: number;
  petal_colors?: string[] | null;
};

const defaultColors = ["#FF69B4", "#FFA500", "#FFD700", "#FF6B6B", "#4ECDC4"];
const gardenPalettes = [
  ["#FF69B4", "#FFA500", "#FFD700", "#FF6B6B", "#4ECDC4"],
  ["#8E44AD", "#3498DB", "#1ABC9C", "#F1C40F", "#E67E22"],
  ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#D4A5A5"],
];

export default function RewardsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .limit(1)
          .single();

        if (error) throw error;
        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching profile:", error);
        setProfile({
          petals_progress: 0,
          flowers_collected: 0,
          petal_colors: defaultColors,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [supabase]);

  const petalsFilled = Math.max(0, Math.min(5, profile?.petals_progress ?? 0));
  const petalColors = useMemo(() => {
    const base =
      profile?.petal_colors && profile.petal_colors.length > 0
        ? profile.petal_colors
        : defaultColors;
    return [...base, ...defaultColors].slice(0, 5);
  }, [profile?.petal_colors]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Laster inn belønninger...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Kunne ikke laste inn profil</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-32">
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Tilbake"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <div className="text-right">
            <p className="text-sm text-gray-500">Belønninger</p>
            <h1 className="text-2xl font-bold text-gray-900">
              Min Blomsterhage 🌸
            </h1>
          </div>
        </div>

        {/* Main Stage */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-200 mb-10">
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            <div className="flex-1 flex justify-center">
              <FlowerPot
                petalsFilled={petalsFilled}
                colors={petalColors}
                size={240}
              />
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-4">
                <p className="text-base font-semibold text-gray-900">
                  Du har {petalsFilled} av 5 kronblader
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Fullfør oppgaver for å fylle blomsten og lås opp en ny i
                  hagen.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className={`h-3 flex-1 rounded-full transition-colors ${
                          index < petalsFilled
                            ? "bg-gradient-to-r from-pink-400 via-amber-300 to-teal-300"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0</span>
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-xl p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-teal-700 font-semibold">
                    Status
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    Pågående blomst
                  </p>
                  <p className="text-sm text-gray-700">
                    Samle alle 5 kronblader.
                  </p>
                </div>
                <div className="bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-100 rounded-xl p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">
                    Hage
                  </p>
                  <p className="text-sm text-gray-700 mb-3">
                    Fullførte blomster i samlingen.
                  </p>
                  {profile.flowers_collected > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({
                        length: Math.min(3, profile.flowers_collected),
                      }).map((_, index) => (
                        <div key={index} className="flex justify-center">
                          <FlowerPot
                            petalsFilled={5}
                            colors={[
                              "#FFD700",
                              "#FF69B4",
                              "#87CEEB",
                              "#FFA500",
                              "#90EE90",
                            ]}
                            size={60}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic">
                      Ingen blomster ennå
                    </p>
                  )}
                  {profile.flowers_collected > 3 && (
                    <p className="text-xs text-gray-600 text-center mt-2">
                      +{profile.flowers_collected - 3} flere
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collection */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            Hagen din
          </h2>
          {profile.flowers_collected > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {Array.from({ length: profile.flowers_collected }).map(
                (_, index) => {
                  const palette = gardenPalettes[index % gardenPalettes.length];
                  return (
                    <div key={index} className="flex justify-center">
                      <FlowerPot petalsFilled={5} colors={palette} size={140} />
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">
              Du har ikke samlet noen blomster ennå. Fullfør en blomst for å
              starte hagen!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
