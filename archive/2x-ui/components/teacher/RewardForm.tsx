"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { EmojiPickerButton } from "@/components/ui/emoji-picker";

export type RewardFormData = {
  title: string;
  description: string;
  emoji: string;
  cost: number;
  cost_type: "points" | "flowers" | "petals" | "level" | "attendance";
  selectedStudentIds: string[];
  max_uses: number | null;
};

export type StudentOption = {
  id: string;
  full_name: string;
};

interface RewardFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RewardFormData) => Promise<void>;
  initialData?: Partial<RewardFormData> | null;
  students: StudentOption[];
  /** When true, header says "Rediger" and button says "Oppdater" */
  isEditing?: boolean;
}

const DEFAULT_FORM: RewardFormData = {
  title: "",
  description: "",
  emoji: "🎁",
  cost: 50,
  cost_type: "points",
  selectedStudentIds: [],
  max_uses: null,
};

export default function RewardForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  students,
  isEditing = false,
}: RewardFormProps) {
  const [formData, setFormData] = useState<RewardFormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...DEFAULT_FORM, ...initialData });
    }
  }, [isOpen, initialData]);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.emoji.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {isEditing ? "Rediger Belønning" : "Ny Belønning"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Title */}
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

          {/* Description */}
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

          {/* Emoji */}
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

          {/* Cost Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Valuta
            </label>
            <select
              value={formData.cost_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cost_type: e.target.value as RewardFormData["cost_type"],
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

          {/* Cost Value */}
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

          {/* Max Uses */}
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

          {/* Student Assignment */}
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
                  {formData.selectedStudentIds.length !== 1 ? "er" : ""} valgt
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

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !formData.title.trim() || !formData.emoji.trim() || submitting
            }
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isEditing ? "Oppdater" : "Opprett"}
          </button>
        </div>
      </div>
    </div>
  );
}
