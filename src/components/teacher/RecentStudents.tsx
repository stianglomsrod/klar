"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, ArrowRight } from "lucide-react";
import { isImageUrl } from "@/utils/avatar";
import { createClient } from "@/utils/supabase/client";
import { useTeacherProfile } from "@/hooks/useTeacherProfile";
import Link from "next/link";

// ── Types ────────────────────────────────────────────
type RecentStudent = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  visitedAt: number; // epoch ms
};

type SearchResult = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

const STORAGE_KEY_PREFIX = "klar_recent_students_";
const MAX_RECENT = 4;

function getStorageKey(teacherId: string) {
  return `${STORAGE_KEY_PREFIX}${teacherId}`;
}

// ── Public helpers (call from other pages) ───────────
/** Record a student visit. Call this when a teacher navigates to a student page. */
export function recordStudentVisit(
  teacherId: string,
  student: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  },
) {
  if (!teacherId) return;
  try {
    const key = getStorageKey(teacherId);
    const raw = localStorage.getItem(key);
    const list: RecentStudent[] = raw ? JSON.parse(raw) : [];

    // Remove if already in list, then prepend
    const filtered = list.filter((s) => s.id !== student.id);
    filtered.unshift({ ...student, visitedAt: Date.now() });

    // Keep only the most recent N
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable — silent fail
  }
}

// ── Component ────────────────────────────────────────
export default function RecentStudents() {
  const router = useRouter();
  const { profile } = useTeacherProfile();
  const teacherId = profile?.id ?? null;

  // Mounted guard — prevents hydration mismatch from localStorage
  const [mounted, setMounted] = useState(false);
  const [students, setStudents] = useState<RecentStudent[]>([]);
  const [enriched, setEnriched] = useState(false);

  // Read localStorage only after mount and once we have a teacher ID
  useEffect(() => {
    if (!teacherId) {
      setMounted(true);
      return;
    }
    try {
      const raw = localStorage.getItem(getStorageKey(teacherId));
      if (raw) setStudents(JSON.parse(raw));
    } catch {
      // localStorage unavailable — silent fail
    }
    setMounted(true);
  }, [teacherId]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Enrich stale entries (avatar might have changed) — one-time
  useEffect(() => {
    if (students.length === 0 || enriched) return;

    const ids = students.map((s) => s.id);
    const supabase = createClient();

    supabase
      .from("student_profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map(data.map((d) => [d.id, d]));
        setStudents((prev) =>
          prev.map((s) => {
            const fresh = map.get(s.id);
            return fresh
              ? {
                  ...s,
                  full_name: fresh.full_name,
                  avatar_url: fresh.avatar_url,
                }
              : s;
          }),
        );
        setEnriched(true);
      });
  }, [students, enriched]);

  // Search students in Supabase
  const searchStudents = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("role", "student")
        .ilike("full_name", `%${query}%`)
        .order("full_name")
        .limit(6);

      setSearchResults(data || []);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchStudents(value), 300);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Shared avatar / initials helper ────────────────
  const renderAvatar = (name: string, avatarUrl: string | null) => {
    const initials = (name || "E")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return isImageUrl(avatarUrl) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover"
      />
    ) : avatarUrl ? (
      <div className="flex items-center justify-center w-8 h-8 text-lg">
        {avatarUrl}
      </div>
    ) : (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
        {initials}
      </div>
    );
  };

  // SSR / pre-mount: render a matching empty shell so HTML is identical
  if (!mounted) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Elever</h2>
        </div>
        <div className="h-10 rounded-lg bg-slate-50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Elever</h2>
      </div>

      {/* Search bar */}
      <div ref={searchRef} className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Søk etter elev…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowResults(true);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-300 outline-none transition-colors placeholder:text-slate-400"
          />
        </div>

        {/* Search results dropdown */}
        {showResults && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto">
            {isSearching ? (
              <div className="px-4 py-3 text-sm text-slate-400">Søker…</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">
                Ingen treff for «{searchQuery}»
              </div>
            ) : (
              searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setShowResults(false);
                    setSearchQuery("");
                    router.push(`/teacher/students/${s.id}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  {renderAvatar(s.full_name, s.avatar_url)}
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {s.full_name}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Recent students list or empty state */}
      {students.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400 mb-3">
            Søk etter en elev ovenfor, eller bla gjennom alle elevene dine.
          </p>
          <Link
            href="/teacher/classes?tab=elever"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Se alle elever
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Nylig besøkt
          </p>
          <div className="space-y-1">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/teacher/students/${s.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
              >
                {renderAvatar(s.full_name, s.avatar_url)}
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 truncate">
                  {s.full_name}
                </span>
              </button>
            ))}
          </div>

          {/* Footer link */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Link
              href="/teacher/classes?tab=elever"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Se alle elever
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
