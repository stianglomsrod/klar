"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Trash2, Edit2, Clock, AlertCircle, Check } from "lucide-react";

type ScheduleEntry = {
  id: string;
  class_id: string | null;
  student_id: string | null;
  subject_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: string;
  custom_title: string | null;
};

type Subject = {
  id: string;
  title: string;
  emoji: string;
};

const DAYS_OF_WEEK = [
  { number: 1, name: "Mandag" },
  { number: 2, name: "Tirsdag" },
  { number: 3, name: "Onsdag" },
  { number: 4, name: "Torsdag" },
  { number: 5, name: "Fredag" },
];

const SCHEDULE_TYPES = ["lesson", "break", "activity"];

type WeeklyScheduleEditorProps = {
  classId: string;
  studentId?: string;
};

export default function WeeklyScheduleEditor({
  classId,
  studentId,
}: WeeklyScheduleEditorProps) {
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);

  const [formData, setFormData] = useState({
    subject_id: "",
    day_of_week: 1,
    start_time: "09:00",
    end_time: "10:00",
    type: "lesson",
    custom_title: "",
    target: studentId ? "student" : "class",
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, title, emoji")
        .order("title");

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Fetch schedule entries
      let query = supabase.from("schedule_entries").select("*");

      if (studentId) {
        // Student mode: show class entries + personal entries
        query = query.or(
          `and(class_id.eq.${classId},student_id.is.null),student_id.eq.${studentId}`
        );
      } else {
        // Class mode: show only class entries
        query = query.eq("class_id", classId).is("student_id", null);
      }

      const { data: entriesData, error: entriesError } = await query.order(
        "day_of_week"
      );

      if (entriesError) throw entriesError;
      setScheduleEntries(entriesData || []);
    } catch (error) {
      console.error("Error fetching schedule data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entry?: ScheduleEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        subject_id: entry.subject_id || "",
        day_of_week: entry.day_of_week,
        start_time: entry.start_time,
        end_time: entry.end_time,
        type: entry.type,
        custom_title: entry.custom_title || "",
        target: entry.student_id ? "student" : "class",
      });
    } else {
      setEditingEntry(null);
      setFormData({
        subject_id: "",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
        type: "lesson",
        custom_title: "",
        target: studentId ? "student" : "class",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.subject_id && !formData.custom_title) {
      alert("Velg fag eller skriv en tittel");
      return;
    }

    if (formData.start_time >= formData.end_time) {
      alert("Starttiden må være før sluttiden");
      return;
    }

    try {
      const entryData = {
        subject_id: formData.subject_id || null,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        type: formData.type,
        custom_title: formData.custom_title || null,
        class_id: classId,
        student_id: formData.target === "student" ? studentId : null,
      };

      if (editingEntry) {
        const { error } = await supabase
          .from("schedule_entries")
          .update(entryData)
          .eq("id", editingEntry.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedule_entries")
          .insert(entryData);

        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving schedule entry:", error);
      alert("Kunne ikke lagre timeplanen. Prøv igjen.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne oppgaven?")) return;

    try {
      const { error } = await supabase
        .from("schedule_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error deleting schedule entry:", error);
      alert("Kunne ikke slette timeplanen. Prøv igjen.");
    }
  };

  const getSubjectTitle = (subjectId: string | null) => {
    if (!subjectId) return "";
    const subject = subjects.find((s) => s.id === subjectId);
    return subject ? `${subject.emoji} ${subject.title}` : "";
  };

  const getEntriesForDay = (dayNumber: number) => {
    return scheduleEntries
      .filter((e) => e.day_of_week === dayNumber)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-slate-400">Laster timeplan...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">
          {studentId ? "Personlig timeplan" : "Klassens timeplan"}
        </h2>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          Legg til time
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS_OF_WEEK.map((day) => {
          const dayEntries = getEntriesForDay(day.number);
          return (
            <div
              key={day.number}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm"
            >
              {/* Day Header */}
              <div className="bg-indigo-50 border-b border-slate-200 p-3">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {day.name}
                </h3>
              </div>

              {/* Day Entries */}
              <div className="divide-y divide-slate-200 min-h-[400px] p-2 space-y-2">
                {dayEntries.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2 text-center">
                    Ingen timer
                  </div>
                ) : (
                  dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-2 rounded text-xs group relative ${
                        entry.student_id
                          ? "bg-amber-50 border-l-2 border-amber-400"
                          : "bg-slate-50 border-l-2 border-indigo-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          {entry.student_id && (
                            <div className="inline-block px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-xs font-medium mb-1">
                              Personlig
                            </div>
                          )}
                          <p className="font-semibold text-slate-900 truncate">
                            {entry.custom_title ||
                              getSubjectTitle(entry.subject_id)}
                          </p>
                          <p className="text-slate-600 flex items-center gap-1">
                            <Clock size={12} />
                            {entry.start_time.slice(0, 5)} -{" "}
                            {entry.end_time.slice(0, 5)}
                          </p>
                        </div>
                        <div className="hidden group-hover:flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleOpenModal(entry)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Rediger"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                            title="Slett"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingEntry ? "Rediger time" : "Legg til time"}
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
                      Kun denne eleven
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

            {/* Custom Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                Eller skriv tittel:
              </label>
              <input
                type="text"
                value={formData.custom_title}
                onChange={(e) =>
                  setFormData({ ...formData, custom_title: e.target.value })
                }
                placeholder="f.eks. Logoped"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Day Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Dag:</label>
              <select
                value={formData.day_of_week}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    day_of_week: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.number} value={day.number}>
                    {day.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Start:
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Slutt:
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                Type:
              </label>
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

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
