"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Flower,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

type Reward = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cost: number;
  cost_type: "points" | "flowers" | "petals" | "level";
  created_by: string;
  created_at: string;
};

type RewardFormData = {
  title: string;
  description: string;
  emoji: string;
  cost: number;
  cost_type: "points" | "flowers" | "petals" | "level";
};

export default function RewardsLibraryPage() {
  const supabase = createClient();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState<RewardFormData>({
    title: "",
    description: "",
    emoji: "🎁",
    cost: 50,
    cost_type: "points",
  });

  useEffect(() => {
    fetchRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      alert("Kunne ikke laste belønninger");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (reward?: Reward) => {
    if (reward) {
      setEditingReward(reward);
      setFormData({
        title: reward.title,
        description: reward.description,
        emoji: reward.emoji,
        cost: reward.cost,
        cost_type: reward.cost_type,
      });
    } else {
      setEditingReward(null);
      setFormData({
        title: "",
        description: "",
        emoji: "🎁",
        cost: 50,
        cost_type: "points",
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
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert("Vennligst skriv inn en tittel");
      return;
    }

    if (!formData.emoji.trim()) {
      alert("Vennligst velg et ikon");
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
            description: formData.description.trim(),
            emoji: formData.emoji.trim(),
            cost: formData.cost,
            cost_type: formData.cost_type,
          })
          .eq("id", editingReward.id);

        if (error) throw error;

        setRewards((prev) =>
          prev.map((r) =>
            r.id === editingReward.id
              ? {
                  ...r,
                  title: formData.title.trim(),
                  description: formData.description.trim(),
                  emoji: formData.emoji.trim(),
                  cost: formData.cost,
                  cost_type: formData.cost_type,
                }
              : r
          )
        );

        alert("Belønning oppdatert!");
      } else {
        // Create new reward
        const { data, error } = await supabase
          .from("rewards")
          .insert([
            {
              title: formData.title.trim(),
              description: formData.description.trim(),
              emoji: formData.emoji.trim(),
              cost: formData.cost,
              cost_type: formData.cost_type,
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        setRewards((prev) => [data, ...prev]);
        alert("Belønning opprettet!");
      }

      handleCloseDialog();
    } catch (error) {
      console.error("Error saving reward:", error);
      alert("Kunne ikke lagre belønning. Prøv igjen.");
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne belønningen?")) return;

    try {
      const { error } = await supabase
        .from("rewards")
        .delete()
        .eq("id", rewardId);

      if (error) throw error;

      setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      alert("Belønning slettet!");
    } catch (error) {
      console.error("Error deleting reward:", error);
      alert("Kunne ikke slette belønning. Prøv igjen.");
    }
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
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
              >
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

                  {/* Cost Badge */}
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${getCostColor(
                      reward.cost_type
                    )}`}
                  >
                    {getCostIcon(reward.cost_type)}
                    <span>
                      {reward.cost} {getCostLabel(reward.cost_type)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenDialog(reward)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Rediger
                  </button>
                  <button
                    onClick={() => handleDelete(reward.id)}
                    className="px-3 py-2 text-sm font-medium text-red-600 bg-white hover:bg-red-50 border border-red-300 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
          onClick={handleCloseDialog}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
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
                  value={formData.title}
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
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Kort beskrivelse av belønningen..."
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Emoji Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Ikon (Emoji) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) =>
                    setFormData({ ...formData, emoji: e.target.value })
                  }
                  placeholder="🎁"
                  maxLength={2}
                  className="w-full px-4 py-2.5 text-2xl text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Lim inn en emoji (f.eks. 🎁 🍕 ⏰ 🎨)
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
                        | "level",
                    })
                  }
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="points">Poeng ⭐</option>
                  <option value="flowers">Blomster 🌸</option>
                  <option value="petals">Kronblader ✨</option>
                  <option value="level">Nivå 📈</option>
                </select>
              </div>

              {/* Cost Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Kostnad
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
                  step="5"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
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
    </div>
  );
}
