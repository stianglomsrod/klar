"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

// Curated, child-appropriate emoji avatars grouped by category
const AVATAR_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Dyr",
    emojis: [
      "🦄",
      "🐶",
      "🐱",
      "🐼",
      "🦊",
      "🐸",
      "🐵",
      "🦁",
      "🐯",
      "🐰",
      "🐻",
      "🐨",
      "🦋",
      "🐢",
      "🦈",
    ],
  },
  {
    label: "Sport & Aktivitet",
    emojis: ["⚽", "🏀", "🎸", "🎨", "🛹", "🚀", "🏄", "🎯"],
  },
  {
    label: "Natur & Verdensrom",
    emojis: ["🌈", "🌸", "🌻", "🍀", "🌙", "⭐", "🪐", "🌊"],
  },
  {
    label: "Kule Smileys",
    emojis: ["😎", "🤩", "😺", "👻", "🤖", "🧑‍🚀", "🧙", "🦸"],
  },
];

interface AvatarPickerModalProps {
  open: boolean;
  onClose: () => void;
  currentAvatar: string;
  userId: string;
  /** Called after a successful save so the context refreshes globally. */
  onAvatarChanged: () => void;
}

export default function AvatarPickerModal({
  open,
  onClose,
  currentAvatar,
  userId,
  onAvatarChanged,
}: AvatarPickerModalProps) {
  const [selected, setSelected] = useState(currentAvatar);
  const [saving, setSaving] = useState(false);

  if (typeof document === "undefined") return null;

  const handleSave = async () => {
    if (selected === currentAvatar) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: selected })
        .eq("id", userId);

      if (error) throw error;

      onAvatarChanged();
      onClose();
    } catch {
      // Silently fail — the avatar stays unchanged
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="text-4xl mb-2">
                {selected.startsWith("http") ? (
                  <img
                    src={selected}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full mx-auto object-cover border-2 border-indigo-200"
                  />
                ) : (
                  selected
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                Velg din avatar
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Trykk på en emoji for å velge
              </p>
            </div>

            {/* Emoji grid */}
            <div className="px-4 pb-3 max-h-[50vh] overflow-y-auto space-y-3">
              {AVATAR_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                    {cat.label}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {cat.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setSelected(emoji)}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl transition-all duration-150 ${
                          selected === emoji
                            ? "bg-indigo-100 ring-2 ring-indigo-400 scale-110"
                            : "hover:bg-slate-100 hover:scale-105 active:scale-95"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors"
              >
                {saving ? "Lagrer…" : "Velg"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
