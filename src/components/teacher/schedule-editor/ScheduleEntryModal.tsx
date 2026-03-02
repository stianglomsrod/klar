"use client";

import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import TimePicker from "@/components/ui/time-picker";
import type { ScheduleFormData, Subject } from "./types";
import { DAYS_OF_WEEK, SCHEDULE_TYPES } from "./types";

type ScheduleEntryModalProps = {
  formData: ScheduleFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScheduleFormData>>;
  subjects: Subject[];
  isEditing: boolean;
  selectedWeekNumber: number;
  studentId?: string;
  studentName?: string;
  alsoSaveAsMasterplan: boolean;
  setAlsoSaveAsMasterplan: (v: boolean) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function ScheduleEntryModal({
  formData,
  setFormData,
  subjects,
  isEditing,
  selectedWeekNumber,
  studentId,
  studentName,
  alsoSaveAsMasterplan,
  setAlsoSaveAsMasterplan,
  onSave,
  onClose,
}: ScheduleEntryModalProps) {
  const toggleDay = (day: number) => {
    setFormData((prev) => {
      const days = prev.selected_days.includes(day)
        ? prev.selected_days.filter((d) => d !== day)
        : [...prev.selected_days, day].sort((a, b) => a - b);
      return { ...prev, selected_days: days };
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">
          {isEditing ? "Rediger time" : "Legg til time"}
          {selectedWeekNumber === 0
            ? " (Fast Timeplan)"
            : ` (Uke ${selectedWeekNumber})`}
        </h3>

        {/* Target Selector (if studentId is available) */}
        {studentId && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              For hvem:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="class"
                  checked={formData.target === "class"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target: e.target.value,
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Hele klassen</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="student"
                  checked={formData.target === "student"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target: e.target.value,
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">
                  Kun {studentName || "denne eleven"}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Subject Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">
            Fag (valgfritt hvis tittel er satt):
          </label>
          <select
            value={formData.subject_id}
            onChange={(e) =>
              setFormData({ ...formData, subject_id: e.target.value })
            }
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Velg fag</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.emoji} {subject.title}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Title — disabled when a subject is selected */}
        <div className="space-y-2">
          <label
            className={`text-sm font-medium ${
              formData.subject_id ? "text-slate-400" : "text-slate-900"
            }`}
          >
            Eller skriv tittel:
          </label>
          <input
            type="text"
            value={formData.subject_id ? "" : formData.custom_title}
            onChange={(e) =>
              setFormData({ ...formData, custom_title: e.target.value })
            }
            disabled={!!formData.subject_id}
            placeholder={
              formData.subject_id
                ? "Deaktivert — fag er valgt"
                : "f.eks. Logoped"
            }
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
              formData.subject_id
                ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                : "border-slate-200 bg-white"
            }`}
          />
        </div>

        {/* Day Selection — multi-select toggle buttons */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Dager:</label>
          <div className="flex gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = formData.selected_days.includes(day.number);
              return (
                <button
                  key={day.number}
                  type="button"
                  onClick={() => toggleDay(day.number)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  selected_days: [1, 2, 3, 4, 5],
                })
              }
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Alle dager
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, selected_days: [] })}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              Ingen
            </button>
          </div>
        </div>

        {/* Time Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Start:</label>
            <TimePicker
              value={formData.start_time}
              onChange={(val) =>
                setFormData({ ...formData, start_time: val })
              }
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Slutt:</label>
            <TimePicker
              value={formData.end_time}
              onChange={(val) =>
                setFormData({ ...formData, end_time: val })
              }
              className="w-full"
            />
          </div>
        </div>

        {/* Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Type:</label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value })
            }
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SCHEDULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "lesson"
                  ? "Time"
                  : type === "break"
                    ? "Pause"
                    : "Aktivitet"}
              </option>
            ))}
          </select>
        </div>

        {/* Masterplan toggle — only when saving to a specific week (not week 0) */}
        {selectedWeekNumber > 0 && (
          <label className="flex items-center gap-3 pt-1 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={alsoSaveAsMasterplan}
              onClick={() => setAlsoSaveAsMasterplan(!alsoSaveAsMasterplan)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                alsoSaveAsMasterplan ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  alsoSaveAsMasterplan
                    ? "translate-x-[18px]"
                    : "translate-x-[3px]"
                }`}
              />
            </button>
            <span className="text-sm text-slate-700">
              Lagre også som fast timeplan
            </span>
          </label>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
          >
            Avbryt
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Lagre
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
