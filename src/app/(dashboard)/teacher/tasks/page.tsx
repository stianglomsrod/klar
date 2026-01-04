"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, MoreVertical, Users, ArrowRight } from "lucide-react";
import { getSubjectTheme } from "@/utils/subject-colors";
import CreateTaskButton from "@/components/teacher/CreateTaskButton";

interface Subject {
  id: string;
  title: string;
  emoji: string;
  color_theme: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  subject: string;
  subjectColor: string;
  type: "standard" | "quiz";
  gradeLevel: string;
  assignCount: number;
}

interface TaskLibraryItem {
  id: string;
  title: string;
  type: "standard" | "quiz";
  grade_level: string;
  usage_count: number;
  subject: {
    title: string;
    emoji: string;
    color_theme: string;
  };
}

export default function TaskLibraryPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchSubjects();
    fetchTasks();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("title", { ascending: true });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_library")
        .select(
          `
          *,
          subject:subjects (
            title,
            emoji,
            color_theme
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map database response to TaskTemplate interface
      const mappedTasks: TaskTemplate[] =
        data?.map((task: any) => ({
          id: task.id,
          title: task.title,
          subject: task.subject?.title || "Ukjent",
          subjectColor: task.subject?.color_theme || "blue",
          type: task.type,
          gradeLevel: task.grade_level || "Alle trinn",
          assignCount: task.usage_count || 0,
        })) || [];

      setTasks(mappedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  // Define core subjects
  const CORE_SUBJECTS = [
    "Matte",
    "Matematikk",
    "Norsk",
    "Engelsk",
    "Samfunnsfag",
    "Naturfag",
    "KRLE",
    "Gym",
    "Kroppsøving",
    "Kunst og håndverk",
    "Musikk",
    "Mat og helse",
  ];

  // Split subjects into main (core) and other lists
  const mainSubjects = subjects.filter((subject) =>
    CORE_SUBJECTS.some((core) =>
      subject.title.toLowerCase().includes(core.toLowerCase())
    )
  );

  const otherSubjects = subjects.filter(
    (subject) =>
      !CORE_SUBJECTS.some((core) =>
        subject.title.toLowerCase().includes(core.toLowerCase())
      )
  );

  // Filter tasks based on selected subject and search query
  const filteredTasks = tasks.filter((task) => {
    const matchesSubject = !selectedSubject || task.subject === selectedSubject;
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Subject Filter */}
      <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Filtrer etter fag
          </h2>

          {/* All Tasks */}
          <button
            onClick={() => setSelectedSubject(null)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
              selectedSubject === null
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="mr-2">📚</span>
            Alle oppgaver
          </button>

          {/* Subject List */}
          {loading ? (
            <div className="text-sm text-gray-500 px-3 py-2">Laster...</div>
          ) : (
            <>
              {/* Core Subjects */}
              {mainSubjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubject(subject.title)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                    selectedSubject === subject.title
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-2">{subject.emoji}</span>
                  {subject.title}
                </button>
              ))}

              {/* Other Topics - Accordion */}
              {otherSubjects.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg list-none flex items-center justify-between">
                    <span>Andre emner</span>
                    <span className="text-xs text-gray-400">▼</span>
                  </summary>
                  <div className="mt-1">
                    {otherSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => setSelectedSubject(subject.title)}
                        className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                          selectedSubject === subject.title
                            ? "bg-indigo-50 text-indigo-700 font-medium"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className="mr-2">{subject.emoji}</span>
                        {subject.title}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Oppgavebibliotek
            </h1>

            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Søk i oppgaver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* New Task Button */}
              <CreateTaskButton />
            </div>
          </div>

          {/* Task Grid */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {searchQuery
                  ? "Ingen oppgaver matcher søket ditt"
                  : "Ingen oppgaver funnet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((task) => {
                const theme = getSubjectTheme(task.subjectColor);

                return (
                  <div
                    key={task.id}
                    className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Top color strip */}
                    <div className={`h-1.5 w-full ${theme.base}`} />

                    <div className="p-5 flex-1 flex flex-col">
                      {/* Menu Button - Top Right */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          {/* Badges Row - Subject, Grade, Type */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {/* Badge 1: Subject */}
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-medium ${theme.light} ${theme.text} border-transparent`}
                            >
                              {task.subject}
                            </span>
                            {/* Badge 2: Grade */}
                            <span className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-600 font-medium">
                              {task.gradeLevel}
                            </span>
                            {/* Badge 3: Type */}
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-medium ${
                                task.type === "quiz"
                                  ? "border-purple-200 text-purple-700"
                                  : "border-gray-200 text-gray-600"
                              }`}
                            >
                              {task.type === "quiz" ? "Quiz" : "Oppgave"}
                            </span>
                          </div>
                          {/* Title */}
                          <h3 className="font-bold text-gray-900 text-lg leading-snug">
                            {task.title}
                          </h3>
                        </div>

                        <button
                          onClick={() =>
                            console.log("Menu clicked for task:", task.id)
                          }
                          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors -mt-1 -mr-1"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Spacer to push footer down */}
                      <div className="flex-1"></div>

                      {/* Footer - Sticky Bottom */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        {/* Stats - Left Side */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          <span>Tildelt {task.assignCount} ganger</span>
                        </div>

                        {/* Action Button - Right Side */}
                        <button
                          onClick={() =>
                            console.log("Assign task clicked:", task.id)
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors"
                        >
                          Tildel
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
