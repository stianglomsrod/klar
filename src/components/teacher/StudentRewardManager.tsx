"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Trash2, X, Sparkles } from "lucide-react";
import { EmojiPickerButton } from "@/components/ui/emoji-picker";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";

type Reward = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  is_recurring: boolean;
  max_uses: number | null;
};

interface StudentRewardManagerProps {
  studentId: string;
  studentName: string;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

export default function StudentRewardManager({
  studentId,
  studentName,
  showToast,
}: StudentRewardManagerProps) {
  const supabase = createClient();

  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [rewardModalView, setRewardModalView] = useState<"list" | "create">(
    "list",
  );
  const [newRewardForm, setNewRewardForm] = useState({
    title: "",
    emoji: "",
    is_recurring: true,
    max_uses: null as number | null,
  });
  const [selectedRewards, setSelectedRewards] = useState<string[]>([]);
  const [studentRewards, setStudentRewards] = useState<Reward[]>([]);
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(null);

  // ── Fetch rewards assigned to this student ─────────
  const fetchStudentRewards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("rewards")
        .select(
          "id, name:title, emoji, cost:cost_value, is_recurring, max_uses",
        )
        .contains("specific_student_ids", [studentId]);

      if (error) throw error;
      setStudentRewards(data || []);
    } catch {
      // Silent – rewards list stays empty
    }
  }, [supabase, studentId]);

  const fetchAvailableRewards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("rewards")
        .select(
          "id, name:title, emoji, cost:cost_value, is_recurring, max_uses",
        )
        .or(`specific_student_ids.eq.{},specific_student_ids.cs.{${studentId}}`)
        .order("title");

      if (error) throw error;
      setAvailableRewards(data || []);
    } catch {
      // Silent – rewards list stays empty
    }
  }, [supabase, studentId]);

  useEffect(() => {
    fetchStudentRewards();
  }, [fetchStudentRewards]);

  useEffect(() => {
    if (isRewardModalOpen) {
      fetchAvailableRewards();
      setSelectedRewards(studentRewards.map((r) => r.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRewardModalOpen]);

  // ── Handlers ───────────────────────────────────────
  const handleRemoveReward = async (rewardId: string) => {
    try {
      const { data: reward } = await supabase
        .from("rewards")
        .select("specific_student_ids")
        .eq("id", rewardId)
        .single();

      const updatedIds = (reward?.specific_student_ids || []).filter(
        (id: string) => id !== studentId,
      );

      const { error } = await supabase
        .from("rewards")
        .update({ specific_student_ids: updatedIds })
        .eq("id", rewardId);

      if (error) throw error;
      await fetchStudentRewards();
    } catch {
      showToast("Kunne ikke fjerne belønning. Prøv igjen.", "error");
    }
  };

  const handleAddReward = async () => {
    try {
      const currentRewardIds = studentRewards.map((r) => r.id);
      const rewardsToAdd = selectedRewards.filter(
        (id) => !currentRewardIds.includes(id),
      );
      const rewardsToRemove = currentRewardIds.filter(
        (id) => !selectedRewards.includes(id),
      );

      for (const rewardId of rewardsToAdd) {
        const { data: reward } = await supabase
          .from("rewards")
          .select("specific_student_ids")
          .eq("id", rewardId)
          .single();

        const currentIds: string[] = reward?.specific_student_ids || [];
        if (!currentIds.includes(studentId)) {
          const { error } = await supabase
            .from("rewards")
            .update({ specific_student_ids: [...currentIds, studentId] })
            .eq("id", rewardId);
          if (error) throw error;
        }
      }

      for (const rewardId of rewardsToRemove) {
        const { data: reward } = await supabase
          .from("rewards")
          .select("specific_student_ids")
          .eq("id", rewardId)
          .single();

        const updatedIds = (reward?.specific_student_ids || []).filter(
          (id: string) => id !== studentId,
        );
        const { error } = await supabase
          .from("rewards")
          .update({ specific_student_ids: updatedIds })
          .eq("id", rewardId);
        if (error) throw error;
      }

      await fetchStudentRewards();
      setIsRewardModalOpen(false);
      setSelectedRewards([]);
      setRewardModalView("list");
    } catch {
      showToast("Kunne ikke oppdatere belønninger. Prøv igjen.", "error");
    }
  };

  const handleCreateReward = async () => {
    if (!newRewardForm.title.trim()) {
      showToast("Vennligst skriv inn en tittel", "warning");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("rewards")
        .insert({
          title: newRewardForm.title.trim(),
          emoji: newRewardForm.emoji.trim() || "🎁",
          created_by: user.id,
          specific_student_ids: [studentId],
          cost_type: "level",
          cost_value: 0,
          is_recurring: newRewardForm.max_uses === 1 ? false : true,
          max_uses: newRewardForm.max_uses,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchStudentRewards();
      await fetchAvailableRewards();

      if (data?.id) {
        setSelectedRewards((prev) => [...prev, data.id]);
      }

      setNewRewardForm({
        title: "",
        emoji: "",
        is_recurring: true,
        max_uses: null,
      });
      setRewardModalView("list");
    } catch {
      showToast("Kunne ikke opprette belønning. Prøv igjen.", "error");
    }
  };

  const handleDeleteReward = (rewardId: string) => {
    setConfirmState({
      title: "Slett belønning",
      description:
        "Er du sikker på at du vil slette denne belønningen permanent? Dette vil også fjerne den fra elever som har mottatt den.",
      action: async () => {
        try {
          const { error: rewardError } = await supabase
            .from("rewards")
            .delete()
            .eq("id", rewardId);

          if (rewardError) throw rewardError;

          setSelectedRewards((prev) => prev.filter((id) => id !== rewardId));
          await fetchStudentRewards();
          await fetchAvailableRewards();
        } catch {
          showToast("Kunne ikke slette belønning. Prøv igjen.", "error");
        }
      },
    });
  };

  const toggleRewardSelection = (rewardId: string) => {
    setSelectedRewards((prev) =>
      prev.includes(rewardId)
        ? prev.filter((id) => id !== rewardId)
        : [...prev, rewardId],
    );
  };

  return (
    <>
      {/* Card: Reward Options (Level-Up Selection) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Belønningsvalg
          </h3>
          <button
            onClick={() => setIsRewardModalOpen(true)}
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Legg til valg
          </button>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {studentRewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xl">{reward.emoji}</span>
                  <span className="text-sm font-medium text-slate-700">
                    {reward.name}
                  </span>
                  {reward.max_uses !== null && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded">
                      {reward.max_uses === 1
                        ? "Engangs"
                        : `Maks ${reward.max_uses}×`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveReward(reward.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Fjern fra valg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reward Assignment Modal */}
      {isRewardModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsRewardModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {rewardModalView === "create"
                  ? "Opprett ny belønning"
                  : `Legg til belønning for ${studentName}`}
              </h2>
              <button
                onClick={() => {
                  setIsRewardModalOpen(false);
                  setRewardModalView("list");
                  setNewRewardForm({
                    title: "",
                    emoji: "",
                    is_recurring: true,
                    max_uses: null,
                  });
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {rewardModalView === "list" ? (
                <>
                  {/* Reward Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Velg belønninger fra bibliotek
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableRewards.map((reward) => {
                        const isSelected = selectedRewards.includes(reward.id);

                        return (
                          <div
                            key={reward.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                              isSelected
                                ? "bg-indigo-50 border-indigo-500"
                                : "bg-white border-slate-200 hover:border-indigo-300"
                            }`}
                          >
                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  toggleRewardSelection(reward.id)
                                }
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <span className="text-xl">{reward.emoji}</span>
                              <span className="text-sm font-medium text-slate-700 flex-1">
                                {reward.name}
                              </span>
                              {reward.max_uses !== null && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded">
                                  {reward.max_uses === 1
                                    ? "Engangs"
                                    : `Maks ${reward.max_uses}×`}
                                </span>
                              )}
                            </label>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReward(reward.id);
                              }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Slett belønning permanent"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-slate-500">
                        Eller
                      </span>
                    </div>
                  </div>

                  {/* Create New Reward Button */}
                  <button
                    onClick={() => setRewardModalView("create")}
                    className="w-full px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-5 w-5" />
                    Opprett ny belønning
                  </button>
                </>
              ) : (
                <>
                  {/* Create Reward Form */}
                  <div className="space-y-4">
                    {/* Title Field */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Tittel <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newRewardForm.title}
                        onChange={(e) =>
                          setNewRewardForm({
                            ...newRewardForm,
                            title: e.target.value,
                          })
                        }
                        placeholder="F.eks. Ekstra frikvarter"
                        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Emoji Field — uses EmojiPickerButton */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Ikon (Emoji){" "}
                        <span className="text-xs font-normal text-slate-500">
                          (valgfritt)
                        </span>
                      </label>
                      <EmojiPickerButton
                        value={newRewardForm.emoji}
                        onChange={(emoji) =>
                          setNewRewardForm({ ...newRewardForm, emoji })
                        }
                        placeholder="🎁"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Hvis ingen emoji velges, brukes standardikon (🎁)
                      </p>
                    </div>

                    {/* Max uses selector */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Antall ganger per elev
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNewRewardForm({
                              ...newRewardForm,
                              max_uses: null,
                              is_recurring: true,
                            })
                          }
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                            newRewardForm.max_uses === null
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                          }`}
                        >
                          Ubegrenset
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewRewardForm({
                              ...newRewardForm,
                              max_uses: 1,
                              is_recurring: false,
                            })
                          }
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                            newRewardForm.max_uses !== null
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                          }`}
                        >
                          Begrenset
                        </button>
                      </div>
                      {newRewardForm.max_uses !== null && (
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={newRewardForm.max_uses}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setNewRewardForm({
                                ...newRewardForm,
                                max_uses: isNaN(val) || val < 1 ? 1 : val,
                                is_recurring: val !== 1,
                              });
                            }}
                            className="w-20 px-3 py-2 text-sm text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <span className="text-sm text-slate-500">
                            {newRewardForm.max_uses === 1
                              ? "gang — forsvinner etter bruk"
                              : "ganger per elev"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Merk:</strong> Denne belønningen vil kun være
                        tilgjengelig for {studentName}.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              {rewardModalView === "list" ? (
                <>
                  <button
                    onClick={() => {
                      setIsRewardModalOpen(false);
                      setRewardModalView("list");
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handleAddReward}
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    Oppdater valg
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRewardModalView("list");
                      setNewRewardForm({
                        title: "",
                        emoji: "",
                        is_recurring: true,
                        max_uses: null,
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Tilbake
                  </button>
                  <button
                    onClick={handleCreateReward}
                    disabled={!newRewardForm.title.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Lagre
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </>
  );
}
