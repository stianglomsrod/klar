"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  UserPlus,
  Copy,
  Check,
  Link2,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SubAccount = {
  id: string;
  email: string;
  full_name: string | null;
  is_substitute: boolean;
  assignments: Assignment[];
};

type Assignment = {
  id: string;
  class_id: string | null;
  student_id: string | null;
  real_name: string | null;
  class_name?: string;
  student_name?: string;
};

type ClassOption = { id: string; name: string; grade_name: string };

export default function SubstituteManager() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);

    // Fetch substitute accounts
    const { data: subs } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_substitute")
      .eq("is_substitute", true)
      .order("email");

    // Fetch assignments with related data
    const { data: assignments } = await supabase
      .from("substitute_assignments")
      .select(
        "id, substitute_id, class_id, student_id, real_name, classes(name), profiles!substitute_assignments_student_id_fkey(full_name)",
      );

    // Fetch classes for the dropdown
    const { data: classData } = await supabase
      .from("classes")
      .select("id, name, grades(name)")
      .order("name");

    const classOptions: ClassOption[] = (classData ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      grade_name:
        (c.grades as unknown as { name: string } | null)?.name ?? "",
    }));

    // Merge assignments into accounts
    const merged: SubAccount[] = (subs ?? []).map((s) => ({
      ...s,
      assignments: (assignments ?? [])
        .filter((a) => a.substitute_id === s.id)
        .map((a) => ({
          id: a.id,
          class_id: a.class_id,
          student_id: a.student_id,
          real_name: a.real_name,
          class_name:
            (a.classes as unknown as { name: string } | null)?.name ??
            undefined,
          student_name:
            (a.profiles as unknown as { full_name: string } | null)
              ?.full_name ?? undefined,
        })),
    }));

    setAccounts(merged);
    setClasses(classOptions);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Ingen vikarkontoer funnet.</p>
        <p className="text-sm mt-1">
          Kontakt administrator for å opprette vikarkontoer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <SubstituteCard
          key={account.id}
          account={account}
          classes={classes}
          expanded={expandedId === account.id}
          onToggle={() =>
            setExpandedId(expandedId === account.id ? null : account.id)
          }
          onRefresh={fetchData}
        />
      ))}
    </div>
  );
}

// ── Substitute Card ──────────────────────────────────

function SubstituteCard({
  account,
  classes,
  expanded,
  onToggle,
  onRefresh,
}: {
  account: SubAccount;
  classes: ClassOption[];
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => Promise<void>;
}) {
  const isActive = account.assignments.length > 0;
  const displayName =
    account.assignments[0]?.real_name ?? account.full_name ?? account.email;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${isActive ? "bg-green-500" : "bg-slate-300"}`}
          />
          <div className="text-left">
            <p className="font-medium text-slate-900">{displayName}</p>
            <p className="text-sm text-slate-500">{account.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {account.assignments.length} tildelinger
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Panel */}
      {expanded && (
        <div className="border-t border-slate-200 px-5 py-4 space-y-5">
          {/* Active Assignments */}
          {account.assignments.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">
                Aktive tildelinger
              </h4>
              <div className="space-y-2">
                {account.assignments.map((a) => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    onRemove={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add Assignment */}
          <AddAssignmentForm
            substituteId={account.id}
            classes={classes}
            onAdded={onRefresh}
          />

          {/* Magic Link */}
          <MagicLinkButton email={account.email} />
        </div>
      )}
    </div>
  );
}

// ── Assignment Row ───────────────────────────────────

function AssignmentRow({
  assignment,
  onRemove,
}: {
  assignment: Assignment;
  onRemove: () => Promise<void>;
}) {
  const supabase = createClient();
  const [removing, setRemoving] = useState(false);

  const label = assignment.class_name
    ? `Klasse: ${assignment.class_name}`
    : `Elev: ${assignment.student_name ?? assignment.student_id}`;

  const handleRemove = async () => {
    setRemoving(true);
    await supabase
      .from("substitute_assignments")
      .delete()
      .eq("id", assignment.id);
    await onRemove();
    setRemoving(false);
  };

  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        onClick={handleRemove}
        disabled={removing}
        className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
        title="Fjern tildeling"
      >
        {removing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

// ── Add Assignment Form ──────────────────────────────

function AddAssignmentForm({
  substituteId,
  classes,
  onAdded,
}: {
  substituteId: string;
  classes: ClassOption[];
  onAdded: () => Promise<void>;
}) {
  const supabase = createClient();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [realName, setRealName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!selectedClassId) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("substitute_assignments").insert({
      substitute_id: substituteId,
      class_id: selectedClassId,
      assigned_by: user?.id,
      real_name: realName.trim() || null,
    });

    setSelectedClassId("");
    setRealName("");
    await onAdded();
    setSaving(false);
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-slate-700 mb-2">
        Legg til tildeling
      </h4>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          placeholder="Vikarens navn (valgfritt)"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">Velg klasse...</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade_name ? `${c.grade_name} – ${c.name}` : c.name}
            </option>
          ))}
        </select>
        <Button
          onClick={handleAdd}
          disabled={!selectedClassId || saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Tildel
        </Button>
      </div>
    </div>
  );
}

// ── Magic Link Button ────────────────────────────────

function MagicLinkButton({ email }: { email: string }) {
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    const res = await fetch("/api/admin/substitute-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Noe gikk galt.");
    } else {
      setMagicLink(data.magicLink);
    }

    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!magicLink) return;
    await navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-slate-700 mb-2">
        Innloggingslenke
      </h4>

      {!magicLink ? (
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Generer innloggingslenke
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-700 break-all select-all">
              {magicLink}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              title="Kopier lenke"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-slate-500" />
              )}
            </button>
          </div>
          <p className="text-xs text-amber-600">
            ⚠️ Denne lenken er gyldig i begrenset tid. Del den direkte med
            vikaren.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
