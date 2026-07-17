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
  User,
} from "lucide-react";
import RewardForm, {
  type RewardFormData,
  type StudentOption,
} from "@/components/teacher/RewardForm";

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

export default function RewardsLibraryPage() {
  const supabase = createClient();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);

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
    setEditingReward(reward ?? null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingReward(null);
  };

  const getFormInitialData = (): Partial<RewardFormData> | null => {
    if (!editingReward) return null;
    return {
      title: editingReward.title || "",
      description: editingReward.description || "",
      emoji: editingReward.emoji || "🎁",
      cost: editingReward.cost,
      cost_type: editingReward.cost_type,
      selectedStudentIds: editingReward.specific_student_ids || [],
      max_uses: editingReward.max_uses ?? null,
    };
  };

  const handleFormSubmit = async (formData: RewardFormData) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (editingReward) {
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
                  max_uses: formData.max_uses,
                }
              : r,
          ),
        );
      } else {
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
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

      <RewardForm
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleFormSubmit}
        initialData={getFormInitialData()}
        students={students}
        isEditing={!!editingReward}
      />
      <Toast toast={toast} onClose={hideToast} />
      <ConfirmDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
