"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Star,
  Flower,
  CheckCircle,
  Clock,
  Calendar,
  Gift,
  Edit,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

type StudentProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  due_date: string;
  is_completed: boolean;
  subject: string;
};

// Mock data for UI development
const mockGameData = {
  current_xp: 750,
  next_level_xp: 1000,
  total_points: 3250,
  flowers_collected: 12,
};

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Matematikk: Multiplikasjon 1-10",
    description: "Løs 20 oppgaver om gangetabellen",
    points_value: 50,
    due_date: "2026-01-05",
    is_completed: false,
    subject: "Matematikk",
  },
  {
    id: "2",
    title: "Norsk: Leseforståelse",
    description: "Les kapittel 3 og svar på spørsmålene",
    points_value: 75,
    due_date: "2026-01-03",
    is_completed: false,
    subject: "Norsk",
  },
  {
    id: "3",
    title: "Naturfag: Solsystemet",
    description: "Se videoen om planetene og ta quizen",
    points_value: 100,
    due_date: "2026-01-08",
    is_completed: false,
    subject: "Naturfag",
  },
  {
    id: "4",
    title: "Matematikk: Addisjon",
    description: "Øvingsoppgaver side 24-26",
    points_value: 50,
    due_date: "2025-12-28",
    is_completed: true,
    subject: "Matematikk",
  },
  {
    id: "5",
    title: "Engelsk: Vocabulary",
    description: "Lær 15 nye ord om dyr",
    points_value: 40,
    due_date: "2025-12-30",
    is_completed: true,
    subject: "Engelsk",
  },
];

type Reward = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
};

const mockRewards: Reward[] = [
  { id: "1", name: "Viskelær", emoji: "✏️", cost: 50 },
  { id: "2", name: "Pizza-fredag", emoji: "🍕", cost: 500 },
  { id: "3", name: "Ekstra pause", emoji: "⏰", cost: 200 },
];

const mockRewardLibrary: Reward[] = [
  { id: "lib1", name: "Klistremerke", emoji: "🌟", cost: 25 },
  { id: "lib2", name: "iPad-tid (15 min)", emoji: "📱", cost: 150 },
  { id: "lib3", name: "Velg sang", emoji: "🎵", cost: 100 },
  { id: "lib4", name: "Tegnetid", emoji: "🎨", cost: 75 },
];

export default function StudentDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"todo" | "completed">("todo");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [flowerGameEnabled, setFlowerGameEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [selectedRewards, setSelectedRewards] = useState<string[]>([]);
  const [studentRewards, setStudentRewards] = useState<Reward[]>(mockRewards);

  const supabase = createClient();

  useEffect(() => {
    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchStudent = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, level, class_name")
        .eq("id", studentId)
        .single();

      if (error) throw error;
      setStudent(data);
      setSelectedClass(data.class_name || "");
    } catch (error) {
      console.error("Error fetching student:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "I dag";
    if (date.toDateString() === tomorrow.toDateString()) return "I morgen";

    return date.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
    });
  };

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      Matematikk: "bg-blue-100 text-blue-700",
      Norsk: "bg-green-100 text-green-700",
      Engelsk: "bg-purple-100 text-purple-700",
      Naturfag: "bg-orange-100 text-orange-700",
    };
    return colors[subject] || "bg-slate-100 text-slate-700";
  };

  const handleRemoveReward = (rewardId: string) => {
    setStudentRewards((prev) => prev.filter((r) => r.id !== rewardId));
  };

  const handleAddReward = () => {
    if (selectedRewards.length === 0) return;

    const rewardsToAdd = mockRewardLibrary.filter((r) =>
      selectedRewards.includes(r.id)
    );

    // Filter out rewards that already exist
    const newRewards = rewardsToAdd.filter(
      (reward) => !studentRewards.some((r) => r.id === reward.id)
    );

    if (newRewards.length === 0) {
      alert("Alle valgte belønninger er allerede lagt til!");
      return;
    }

    setStudentRewards((prev) => [...prev, ...newRewards]);
    setIsRewardModalOpen(false);
    setSelectedRewards([]);
  };

  const toggleRewardSelection = (rewardId: string) => {
    setSelectedRewards((prev) =>
      prev.includes(rewardId)
        ? prev.filter((id) => id !== rewardId)
        : [...prev, rewardId]
    );
  };

  const todoTasks = mockTasks.filter((task) => !task.is_completed);
  const completedTasks = mockTasks.filter((task) => task.is_completed);

  const xpPercentage =
    (mockGameData.current_xp / mockGameData.next_level_xp) * 100;

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600">Laster elevdata...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-slate-600 mb-4">Finner ikke eleven</p>
            <button
              onClick={() => router.push("/teacher/classes")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Tilbake til Mine Klasser
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Back Button & Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/teacher/classes")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Tilbake</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Administrer Elev</h1>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Innstillinger & Preferanser
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-900 block mb-1">
                  🔔 Push-varsler
                </label>
                <p className="text-xs text-slate-600">
                  Varsle lærer ved levering
                </p>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  notificationsEnabled ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Flower Game Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-900 block mb-1">
                  🌸 Blomster-spill
                </label>
                <p className="text-xs text-slate-600">Tilgang til minispill</p>
              </div>
              <button
                onClick={() => setFlowerGameEnabled(!flowerGameEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  flowerGameEnabled ? "bg-green-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flowerGameEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="text-sm font-medium text-slate-900 block mb-2">
                Velkomstmelding
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Skriv en personlig melding..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Profile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">
              Profil & Klasse
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Avatar & Name */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xl flex-shrink-0">
                {student.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.avatar_url}
                    alt={student.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  student.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">
                  {student.full_name}
                </h4>
              </div>
            </div>

            {/* Class Selection */}
            <div>
              <label className="text-sm font-medium text-slate-900 block mb-2">
                Klasse
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="">Ingen klasse</option>
                <option value="3B">3B</option>
                <option value="5A">5A</option>
                <option value="8A">8A</option>
                <option value="10. Trinn">10. Trinn</option>
              </select>
            </div>

            {/* Reset Password */}
            <button className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Nullstill passord
            </button>
          </div>
        </div>

        {/* Card 3: Stats & Reward */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">
              Nivå & Valuta
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Level Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Nivå</span>
              <span className="px-3 py-1 text-sm font-bold text-indigo-700 bg-indigo-100 rounded-full">
                {student.level}
              </span>
            </div>

            {/* XP Progress */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span>Erfaring</span>
                <span className="font-semibold">
                  {mockGameData.current_xp}/{mockGameData.next_level_xp} XP
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${xpPercentage}%` }}
                />
              </div>
            </div>

            {/* Points */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600 fill-yellow-600" />
                <span className="text-sm font-medium text-slate-700">
                  Poeng
                </span>
              </div>
              <span className="text-lg font-bold text-yellow-700">
                {mockGameData.total_points}
              </span>
            </div>

            {/* Flowers */}
            <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Flower className="h-5 w-5 text-pink-600" />
                <span className="text-sm font-medium text-slate-700">
                  Blomster
                </span>
              </div>
              <span className="text-lg font-bold text-pink-700">
                {mockGameData.flowers_collected}
              </span>
            </div>

            {/* Give Reward Button */}
            <button className="w-full px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all flex items-center justify-center gap-2">
              <Gift className="h-4 w-4" />
              Gi Belønning
            </button>
          </div>
        </div>

        {/* Card 4: Reward Options (Level-Up Selection) */}
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

        {/* Card 5: Tasks (Full Width) */}
        <div className="md:col-span-2 lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Aktive Gjøremål
            </h3>
            <button className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Ny Oppgave
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("todo")}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === "todo"
                    ? "text-indigo-600 bg-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Gjøremål</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                    {todoTasks.length}
                  </span>
                </div>
                {activeTab === "todo" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === "completed"
                    ? "text-green-600 bg-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Fullført</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                    {completedTasks.length}
                  </span>
                </div>
                {activeTab === "completed" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />
                )}
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="p-6">
            {activeTab === "todo" ? (
              todoTasks.length > 0 ? (
                <div className="space-y-3">
                  {todoTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded ${getSubjectColor(
                                task.subject
                              )}`}
                            >
                              {task.subject}
                            </span>
                            <div className="flex items-center gap-1 text-amber-600">
                              <Star className="h-4 w-4 fill-amber-600" />
                              <span className="text-sm font-semibold">
                                +{task.points_value}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-semibold text-slate-900 mb-1">
                            {task.title}
                          </h4>
                          <p className="text-sm text-slate-600 mb-3">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Frist: {formatDate(task.due_date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Rediger oppgave"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Slett oppgave"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Ingen aktive oppgaver</p>
                </div>
              )
            ) : completedTasks.length > 0 ? (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${getSubjectColor(
                              task.subject
                            )}`}
                          >
                            {task.subject}
                          </span>
                          <div className="flex items-center gap-1 text-amber-600">
                            <Star className="h-4 w-4 fill-amber-600" />
                            <span className="text-sm font-semibold">
                              +{task.points_value}
                            </span>
                          </div>
                        </div>
                        <h4 className="font-semibold text-slate-900 mb-1">
                          {task.title}
                        </h4>
                        <p className="text-sm text-slate-600 mb-3">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Fullført: {formatDate(task.due_date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Se detaljer"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Ingen fullførte oppgaver ennå</p>
              </div>
            )}
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
                Legg til belønning for {student?.full_name}
              </h2>
              <button
                onClick={() => setIsRewardModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Reward Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Velg belønninger fra bibliotek
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {mockRewardLibrary.map((reward) => {
                    const isAlreadyAdded = studentRewards.some(
                      (r) => r.id === reward.id
                    );
                    const isSelected = selectedRewards.includes(reward.id);

                    return (
                      <label
                        key={reward.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isAlreadyAdded
                            ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "bg-indigo-50 border-indigo-500"
                            : "bg-white border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRewardSelection(reward.id)}
                          disabled={isAlreadyAdded}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
                        />
                        <span className="text-xl">{reward.emoji}</span>
                        <span className="text-sm font-medium text-slate-700 flex-1">
                          {reward.name}
                        </span>
                        {isAlreadyAdded && (
                          <span className="text-xs text-slate-500 italic">
                            Allerede lagt til
                          </span>
                        )}
                      </label>
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
                  <span className="px-2 bg-white text-slate-500">Eller</span>
                </div>
              </div>

              {/* Create New Reward Button */}
              <button className="w-full px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5" />
                Opprett ny belønning
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsRewardModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleAddReward}
                disabled={selectedRewards.length === 0}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Tildel{" "}
                {selectedRewards.length > 0
                  ? `(${selectedRewards.length})`
                  : "Belønning"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
