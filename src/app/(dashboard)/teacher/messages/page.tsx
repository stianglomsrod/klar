"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Trash2, Plus } from "lucide-react";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";
import {
  RecipientSelector,
  type Recipient,
} from "./_components/RecipientSelector";

type Grade = {
  id: string;
  name: string;
};

type Class = {
  id: string;
  name: string;
  grade_id: string;
};

type Student = {
  id: string;
  name: string;
  class_id: string;
};

type Announcement = {
  id: string;
  content: string;
  display_date: string;
  target_type: "student" | "class" | "grade";
  target_id: string;
  created_at: string;
};

type TargetInfo = {
  name: string;
  type: "student" | "class" | "grade";
};

export default function TeacherMessagesPage() {
  const supabase = createClient();

  // Reference data
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Form state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [formDate, setFormDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    visible: boolean;
  }>({ message: "", type: "success", visible: false });
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(null);

  // Fetch reference data
  useEffect(() => {
    const fetchRefData = async () => {
      setIsLoading(true);
      try {
        // Fetch all data in parallel for better performance
        const [gradesRes, classesRes, studentsRes] = await Promise.all([
          supabase.from("grades").select("id, name").order("name"),
          supabase.from("classes").select("id, name, grade_id").order("name"),
          supabase
            .from("student_profiles")
            .select("id, class_id, profiles(full_name)"),
        ]);

        if (gradesRes.error) throw gradesRes.error;
        if (classesRes.error) throw classesRes.error;
        if (studentsRes.error) throw studentsRes.error;

        setGrades(gradesRes.data || []);
        setClasses(classesRes.data || []);

        // Map students with profile data
        const formattedStudents = (studentsRes.data || [])
          .map((s) => {
            // Handle profiles as either array or object
            const profile = Array.isArray(s.profiles)
              ? s.profiles[0]
              : s.profiles;
            return {
              id: s.id,
              name: profile?.full_name || "Ukjent elev",
              class_id: s.class_id,
            };
          })
          .filter((s) => s.class_id) // Only include students with a class
          .sort((a, b) => a.name.localeCompare(b.name, "no"));

        setAllStudents(formattedStudents);
      } catch {
        showToast("Kunne ikke laste data", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRefData();
  }, [supabase]);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from("daily_announcements")
          .select("*")
          .order("display_date", { ascending: false });

        if (error) throw error;
        setAnnouncements(data || []);
      } catch {
        // Silent – announcements list stays empty
      }
    };

    fetchAnnouncements();
  }, [supabase]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  };

  const getTargetName = (announcement: Announcement): TargetInfo => {
    if (announcement.target_type === "grade") {
      const grade = grades.find((g) => g.id === announcement.target_id);
      return { name: grade?.name || "Unknown Grade", type: "grade" };
    } else if (announcement.target_type === "class") {
      const cls = classes.find((c) => c.id === announcement.target_id);
      return { name: cls?.name || "Unknown Class", type: "class" };
    } else {
      const student = allStudents.find((s) => s.id === announcement.target_id);
      return { name: student?.name || "Unknown Student", type: "student" };
    }
  };

  const getSelectedDateAnnouncements = (): Announcement[] => {
    const dateStr = selectedDate.toISOString().split("T")[0];
    return announcements.filter((a) => a.display_date === dateStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageContent.trim()) {
      showToast("Meldingen kan ikke være tom", "error");
      return;
    }

    if (recipients.length === 0) {
      showToast("Velg minst en mottaker", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: user } = await supabase.auth.getUser();

      // Create a separate announcement for each recipient
      const promises = recipients.map((recipient) =>
        supabase.from("daily_announcements").insert({
          content: messageContent,
          display_date: formDate,
          target_type: recipient.type,
          target_id: recipient.id,
          created_by: user.user?.id,
        }),
      );

      const results = await Promise.all(promises);

      // Check for any errors
      const hasError = results.some((result) => result.error);
      if (hasError) {
        throw new Error("One or more inserts failed");
      }

      // Refresh announcements
      const { data: updated } = await supabase
        .from("daily_announcements")
        .select("*")
        .order("display_date", { ascending: false });

      setAnnouncements(updated || []);

      // Reset form
      setMessageContent("");
      setRecipients([]);

      showToast(
        `Melding lagret til ${recipients.length} mottaker(e)!`,
        "success",
      );
    } catch {
      showToast("Kunne ikke lagre melding", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Slett melding",
      description: "Slett denne meldingen?",
      action: async () => {
        try {
          const { error } = await supabase
            .from("daily_announcements")
            .delete()
            .eq("id", id);

          if (error) throw error;

          setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          showToast("Melding slettet", "success");
        } catch {
          showToast("Kunne ikke slette melding", "error");
        }
      },
    });
  };

  const dateAnnouncements = getSelectedDateAnnouncements();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Meldinger</h1>
          <p className="text-slate-600 mt-2">
            Opprett og administrer daglige meldinger for elever
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-12 gap-8">
          {/* LEFT COLUMN - Calendar & Announcements */}
          <div className="col-span-5">
            {/* Calendar Card */}
            <div className="p-6 mb-6 bg-white rounded-lg shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Velg dato
              </h2>
              <div className="flex justify-center">
                <input
                  type="date"
                  value={selectedDate.toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Announcements List */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Meldinger for{" "}
                {selectedDate.toLocaleDateString("no-NO", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h2>

              {dateAnnouncements.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  Ingen meldinger denne dagen
                </p>
              ) : (
                <div className="space-y-3">
                  {dateAnnouncements.map((announcement) => {
                    const target = getTargetName(announcement);
                    return (
                      <div
                        key={announcement.id}
                        className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-indigo-600 uppercase">
                              {target.type === "grade"
                                ? "Trinn"
                                : target.type === "class"
                                  ? "Klasse"
                                  : "Elev"}
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {target.name}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-700">
                          {announcement.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Create New Message */}
          <div className="col-span-7">
            <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200 sticky top-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Ny Melding
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Date Field */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Dato
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Recipient Selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mottakere
                  </label>
                  {isLoading ? (
                    <div className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-center">
                      Laster data...
                    </div>
                  ) : (
                    <RecipientSelector
                      data={{ grades, classes, students: allStudents }}
                      selectedRecipients={recipients}
                      onSelect={setRecipients}
                    />
                  )}
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Melding
                  </label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Skriv meldingen her..."
                    rows={5}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors"
                >
                  {isSubmitting ? "Lagrer..." : "Lagre Melding"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.visible && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg font-medium text-white ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {toast.message}
        </div>
      )}
      <ConfirmDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
