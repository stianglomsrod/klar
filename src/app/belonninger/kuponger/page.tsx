"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";
import CouponCard from "@/components/shared/CouponCard";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";

type StudentReward = {
  id: string;
  reward_id: string;
  is_redeemed: boolean;
  date_earned: string;
  earned_at_level: number;
  reward: {
    title: string;
    description?: string;
    emoji?: string;
  };
};

export default function KupongerPage() {
  const { profile } = useStudentProfile();
  const [rewards, setRewards] = useState<StudentReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(null);

  useEffect(() => {
    fetchRewards();
  }, [profile]);

  const fetchRewards = async () => {
    if (!profile?.id) return;

    const supabase = createClient();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("student_rewards")
        .select(
          `
          *,
          rewards (
            title,
            description,
            emoji,
            cost_value,
            cost_type
          )
        `,
        )
        .eq("student_id", profile.id)
        .order("is_redeemed", { ascending: true })
        .order("date_earned", { ascending: false });

      if (error) {
        throw error;
      }

      // Transform data to match our type
      // Note: Supabase returns the joined rewards as a single object since it's a many-to-one relationship
      const transformedData = (data || []).map((item: any) => ({
        id: item.id,
        reward_id: item.reward_id,
        is_redeemed: item.is_redeemed,
        date_earned: item.date_earned,
        earned_at_level: item.earned_at_level ?? 1,
        reward: item.rewards || {
          title: "Ukjent premie",
          description: "",
          emoji: "🎁",
        },
      }));

      setRewards(transformedData);
    } catch {
      // Don't crash the page, just show empty state
      setRewards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemCoupon = async (rewardId: string) => {
    if (!profile?.id) return;

    // Anti-cheat: block redemption if student's level is below earned_at_level
    const reward = rewards.find((r) => r.id === rewardId);
    if (reward && (profile.level ?? 1) < reward.earned_at_level) {
      showToast(
        `Du m\u00e5 v\u00e6re level ${reward.earned_at_level} for \u00e5 bruke denne kupongen. Du er n\u00e5 level ${profile.level ?? 1}.`,
        "warning",
      );
      return;
    }

    // Show confirmation dialog
    setConfirmState({
      title: "Bruk kupong",
      description:
        "Er du sikker på at du vil bruke denne kupongen?\n\nDu bør kun trykke her når du er sammen med læreren din for å vise at du bruker premien.",
      action: async () => {
        const supabase = createClient();

        try {
          const { error } = await supabase
            .from("student_rewards")
            .update({ is_redeemed: true })
            .eq("id", rewardId);

          if (error) throw error;

          // Show confetti celebration
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);

          // Refresh rewards list
          await fetchRewards();
        } catch {
          showToast(
            "Noe gikk galt ved innløsing av kupongen. Prøv igjen.",
            "error",
          );
        }
      },
    });
  };

  const activeRewards = rewards.filter((r) => !r.is_redeemed);
  const redeemedRewards = rewards.filter((r) => r.is_redeemed);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 font-sans text-gray-900 pb-20">
        <div className="pt-24 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto">
          <div className="text-center py-20 text-indigo-400 animate-pulse font-medium">
            Laster kuponger...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 font-sans text-gray-900 pb-20">
      {/* Confetti celebration */}
      {showConfetti && (
        <Confetti
          width={typeof window !== "undefined" ? window.innerWidth : 300}
          height={typeof window !== "undefined" ? window.innerHeight : 300}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      <div className="pt-24 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Wallet className="w-10 h-10 text-purple-600" />
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 pb-2">
              Mine Kuponger
            </h1>
            <span className="text-5xl">🎫</span>
          </div>
          <p className="text-lg text-gray-600">
            Dine premier og belønninger samlet på ett sted
          </p>
        </motion.div>

        {/* Active Coupons Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-2xl">✨</span>
              Aktive Kuponger
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({activeRewards.length})
              </span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
          </div>

          {activeRewards.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 text-center shadow-lg border border-gray-200"
            >
              <div className="text-6xl mb-4">🎁</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Ingen ubrukte kuponger
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Du har ingen ubrukte kuponger akkurat nå. Gå opp i level for å
                samle flere premier!
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRewards.map((reward, index) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CouponCard
                    title={reward.reward.title}
                    description={reward.reward.description}
                    emoji={reward.reward.emoji}
                    isRedeemed={reward.is_redeemed}
                    isLocked={(profile?.level ?? 1) < reward.earned_at_level}
                    lockedLevel={reward.earned_at_level}
                    dateEarned={reward.date_earned}
                    onRedeem={() => handleRedeemCoupon(reward.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Redeemed Coupons Section (Collapsible) */}
        {redeemedRewards.length > 0 && (
          <section>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full mb-4 flex items-center justify-between p-4 bg-white/60 hover:bg-white/80 rounded-2xl shadow-md transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <h2 className="text-2xl font-bold text-gray-800">
                  Premieskap
                </h2>
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({redeemedRewards.length})
                </span>
              </div>
              {showHistory ? (
                <ChevronUp className="w-6 h-6 text-gray-600 group-hover:text-gray-800 transition-colors" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-600 group-hover:text-gray-800 transition-colors" />
              )}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                    {redeemedRewards.map((reward, index) => (
                      <motion.div
                        key={reward.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <CouponCard
                          title={reward.reward.title}
                          description={reward.reward.description}
                          emoji={reward.reward.emoji}
                          isRedeemed={reward.is_redeemed}
                          dateEarned={reward.date_earned}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
      <Toast toast={toast} onClose={hideToast} />
      <ConfirmDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
        confirmLabel="Bruk kupong"
        confirmClassName="bg-indigo-600 text-white hover:bg-indigo-700"
      />
    </main>
  );
}
