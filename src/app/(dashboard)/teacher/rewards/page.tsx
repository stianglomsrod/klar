"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";
import {
  Plus,
  Edit2,
  Trash2,
  Star,
  Flower,
  Sparkles,
  TrendingUp,
  Flame,
  X,
  User,
} from "lucide-react";
import { EmojiPickerButton } from "@/components/ui/emoji-picker";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  cost: number;
  cost_type: "points" | "flowers" | "petals" | "level" | "attendance";
  created_by: string;
  created_at: string;
  specific_student_ids: string[];
  max_uses: number | null;
};

type RewardFormData = {
  title: string;
  description: string;
  emoji: string;
  cost: number;
  cost_type: "points" | "flowers" | "petals" | "level" | "attendance";
  selectedStudentIds: string[];
  max_uses: number | null;
};

type StudentOption = {
  id: string;
  full_name: string;
};

export default function RewardsLibraryPage() {
  const supabase = createClient();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [formData, setFormData] = useState<RewardFormData>({
    title: "",
    description: "",
    emoji: "🎁",
    cost: 50,
    cost_type: "points",
    selectedStudentIds: [],
    max_uses: null,
  });

  useEffect(() => {
    fetchRewards();
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStudents(
        (data || []).map((s: any) => ({
          id: s.id,
          full_name: s.full_name || "Ukjent elev",
        })),
      );
    } catch {
      // Silent – students list stays empty
    }
  };

  const fetchRewards = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("rewards")
        .select(
          "id, title, description, emoji, cost_value, cost_type, created_by, created_at, specific_student_ids, max_uses",
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRewards(
        (data || []).map((r: any) => ({
          ...r,
          cost: r.cost_value,
        })),
      );
    } catch {
      showToast("Kunne ikke laste belønninger", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (reward?: Reward) => {
    if (reward) {
      setEditingReward(reward);
      setFormData({
        title: reward.title || "",
        description: reward.description || "",
        emoji: reward.emoji || "🎁",
        cost: reward.cost,
        cost_type: reward.cost_type,
        selectedStudentIds: reward.specific_student_ids || [],
        max_uses: reward.max_uses ?? null,
      });
    } else {
      setEditingReward(null);
      setFormData({
        title: "",
        description: "",
        emoji: "🎁",
        cost: 50,
        cost_type: "points",
        selectedStudentIds: [],
        max_uses: null,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingReward(null);
    setFormData({
      title: "",
      description: "",
      emoji: "🎁",
      cost: 50,
      cost_type: "points",
      selectedStudentIds: [],
      max_uses: null,
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showToast("Vennligst skriv inn en tittel", "warning");
      return;
    }

    if (!formData.emoji.trim()) {
      showToast("Vennligst velg et ikon", "warning");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (editingReward) {
        // Update existing reward
        const { error } = await supabase
          .from("rewards")
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            emoji: formData.emoji.trim(),
            cost_value: formData.cost,
            cost_type: formData.cost_type,
            specific_student_ids: formData.selectedStudentIds,
            max_uses: formData.max_uses,
            is_recurring: formData.max_uses !== 1,
          })
          .eq("id", editingReward.id);

        if (error) throw error;

        setRewards((prev) =>
          prev.map((r) =>
            r.id === editingReward.id
              ? {
                  ...r,
                  title: formData.title.trim(),
                  description: formData.description.trim() || null,
                  emoji: formData.emoji.trim(),
                  cost: formData.cost,
                  cost_type: formData.cost_type,
                  specific_student_ids: formData.selectedStudentIds,
                }
              : r,
          ),
        );
      } else {
        // Create new reward
        const { data, error } = await supabase
          .from("rewards")
          .insert([
            {
              title: formData.title.trim(),
              description: formData.description.trim() || null,
              emoji: formData.emoji.trim(),
              cost_value: formData.cost,
              cost_type: formData.cost_type,
              created_by: user.id,
              specific_student_ids: formData.selectedStudentIds,
              max_uses: formData.max_uses,
              is_recurring: formData.max_uses !== 1,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        setRewards((prev) => [{ ...data, cost: data.cost_value }, ...prev]);
      }

      handleCloseDialog();
    } catch {
      showToast("Kunne ikke lagre belønning. Prøv igjen.", "error");
    }
  };

  const handleDelete = async (rewardId: string) => {
    setConfirmState({
      title: "Slett bel\u00f8nning",
      description:
        "Er du sikker p\u00e5 at du vil slette denne bel\u00f8nningen?",
      action: async () => {
        try {
          const { error } = await supabase
            .from("rewards")
            .delete()
            .eq("id", rewardId);

          if (error) throw error;

          setRewards((prev) => prev.filter((r) => r.id !== rewardId));
          showToast("Bel\u00f8nning slettet!", "success");
        } catch {
          showToast(
            "Kunne ikke slette bel\u00f8nning. Pr\u00f8v igjen.",
            "error",
          );
        }
      },
    });
  };

  const getCostIcon = (costType: string) => {
    switch (costType) {
      case "points":
        return <Star className="h-4 w-4" />;
      case "flowers":
        return <Flower className="h-4 w-4" />;
      case "petals":
        return <Sparkles className="h-4 w-4" />;
      case "level":
        return <TrendingUp className="h-4 w-4" />;
      case "attendance":
        return <Flame className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const getCostColor = (costType: string) => {
    switch (costType) {
      case "points":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "flowers":
        return "bg-pink-100 text-pink-700 border-pink-200";
      case "petals":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "level":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "attendance":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getCostLabel = (costType: string) => {
    switch (costType) {
      case "points":
        return "Poeng";
      case "flowers":
        return "Blomster";
      case "petals":
        return "Kronblader";
      case "level":
        return "Nivå";
      case "attendance":
        return "Nærvær";
      default:
        return "Poeng";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Laster belønninger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-slate-900">
              Belønningsbibliotek
            </h1>
            <button
              onClick={() => handleOpenDialog()}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Ny Belønning
            </button>
          </div>
          <p className="text-slate-600">
            Administrer belønninger som elevene kan velge mellom når de rykker
            opp i nivå.
          </p>
        </div>

        {/* Rewards Grid */}
        {rewards.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Ingen belønninger ennå
            </h3>
            <p className="text-slate-600 mb-6">
              Kom i gang ved å opprette din første belønning
            </p>
            <button
              onClick={() => handleOpenDialog()}
              className="px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Opprett Belønning
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                onClick={() => handleOpenDialog(reward)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
              >
                {/* Hover action icons */}
                <div
                  className="absolute top-3 right-3 hidden group-hover:flex gap-1 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDialog(reward);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                    title="Rediger"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(reward.id);
                    }}
                    className="p-1.5 text-slate-600 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                    title="Slett"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="p-6">
                  {/* Emoji Icon */}
                  <div className="text-5xl mb-4">{reward.emoji}</div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">
                    {reward.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[2.5rem]">
                    {reward.description || "Ingen beskrivelse"}
                  </p>

                  {/* Bottom row: Cost Badge + Assignment */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Cost Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${getCostColor(
                          reward.cost_type,
                        )}`}
                      >
                        {getCostIcon(reward.cost_type)}
                        <span>
                          {reward.cost_type === "attendance"
                            ? `Hver ${reward.cost}. dag`
                            : getCostLabel(reward.cost_type)}
                        </span>
                      </div>
                      {reward.max_uses !== null && (
                        <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full">
                          {reward.max_uses === 1
                            ? "Engangs"
                            : `Maks ${reward.max_uses}×`}
                        </span>
                      )}
                    </div>

                    {/* Student assignment badge */}
                    {reward.specific_student_ids.length > 0 &&
                      (() => {
                        const names = reward.specific_student_ids.map(
                          (id) =>
                            students.find((s) => s.id === id)?.full_name ||
                            "Ukjent",
                        );
                        const label =
                          names.length <= 3
                            ? names.join(", ")
                            : `${names.length} elever`;
                        const tooltip = names.join(", ");
                        return (
                          <div
                            className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full"
                            title={tooltip}
                          >
                            <User size={12} />
                            <span className="truncate max-w-[120px]">
                              {label}
                            </span>
                          </div>
                        );
                      })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      {isDialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseDialog();
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Dialog Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">
                {editingReward ? "Rediger Belønning" : "Ny Belønning"}
              </h2>
              <button
                onClick={handleCloseDialog}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="p-6 space-y-5">
              {/* Title Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tittel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="F.eks. Ekstra frikvarter"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Beskrivelse
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Kort beskrivelse av belønningen..."
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Emoji Field — EmojiPickerButton */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Ikon (Emoji) <span className="text-red-500">*</span>
                </label>
                <EmojiPickerButton
                  value={formData.emoji}
                  onChange={(emoji) => setFormData({ ...formData, emoji })}
                  placeholder="🎁"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Klikk for å velge emoji
                </p>
              </div>

              {/* Cost Type Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Valuta
                </label>
                <select
                  value={formData.cost_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost_type: e.target.value as
                        | "points"
                        | "flowers"
                        | "petals"
                        | "level"
                        | "attendance",
                    })
                  }
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="points">Poeng ⭐</option>
                  <option value="flowers">Blomster 🌸</option>
                  <option value="petals">Kronblader ✨</option>
                  <option value="level">Nivå 📈</option>
                  <option value="attendance">Nærvær 🔥</option>
                </select>
              </div>

              {/* Cost Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {formData.cost_type === "attendance" ? "Antall dager" : "Kostnad"}
                </label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step={formData.cost_type === "attendance" ? "1" : "5"}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Max Uses Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Antall ganger per elev
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, max_uses: null })}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                      formData.max_uses === null
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    Ubegrenset
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, max_uses: 1 })}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                      formData.max_uses !== null
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    Begrenset
                  </button>
                </div>
                {formData.max_uses !== null && (
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={formData.max_uses}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFormData({
                          ...formData,
                          max_uses: isNaN(val) || val < 1 ? 1 : val,
                        });
                      }}
                      className="w-20 px-3 py-2 text-sm text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <span className="text-sm text-slate-500">
                      {formData.max_uses === 1
                        ? "gang — forsvinner etter bruk"
                        : "ganger per elev"}
                    </span>
                  </div>
                )}
              </div>

              {/* Student Assignment Field - Multi-select */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tildelt (valgfritt)
                </label>
                <div className="border border-slate-300 rounded-lg max-h-48 overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="p-3 text-sm text-slate-500">
                      Ingen elever funnet
                    </p>
                  ) : (
                    students.map((student) => {
                      const isChecked = formData.selectedStudentIds.includes(
                        student.id,
                      );
                      return (
                        <label
                          key={student.id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors ${
                            isChecked ? "bg-indigo-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData((prev) => ({
                                ...prev,
                                selectedStudentIds: isChecked
                                  ? prev.selectedStudentIds.filter(
                                      (id) => id !== student.id,
                                    )
                                  : [...prev.selectedStudentIds, student.id],
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">
                            {student.full_name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {formData.selectedStudentIds.length > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-indigo-600">
                      {formData.selectedStudentIds.length} elev
                      {formData.selectedStudentIds.length !== 1
                        ? "er"
                        : ""}{" "}
                      valgt
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          selectedStudentIds: [],
                        }))
                      }
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Fjern alle
                    </button>
                  </div>
                )}
                {formData.selectedStudentIds.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Ingen valgt — belønningen er tilgjengelig for alle elever.
                  </p>
                )}
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0">
              <button
                onClick={handleCloseDialog}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.title.trim() || !formData.emoji.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {editingReward ? "Oppdater" : "Opprett"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={hideToast} />
      <ConfirmDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
