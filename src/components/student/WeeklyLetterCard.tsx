"use client";

import { Megaphone, GraduationCap, BookOpen } from "lucide-react";

/* ── Section parser ────────────────────────────────────
   Mirrors the serialisation in save-weekly-plan.ts:

     --- Beskjeder ---
     message1\n\nmessage2

     --- Læringsmål ---
     Subject:\n  • goal\n  • goal\n\nSubject2: …

     --- Lekser ---
     Subject:\n  • task\n  • task
*/

type Section = {
  heading: string;
  blocks: { subject: string | null; items: string[] }[];
};

function parseSections(raw: string): Section[] {
  const sectionRegex = /---\s+(.+?)\s+---/g;
  const parts: { heading: string; body: string }[] = [];

  let match: RegExpExecArray | null;
  const indices: { heading: string; start: number; end: number }[] = [];

  while ((match = sectionRegex.exec(raw)) !== null) {
    indices.push({
      heading: match[1],
      start: match.index + match[0].length,
      end: raw.length, // overwritten below
    });
  }

  // Set end boundaries
  for (let i = 0; i < indices.length; i++) {
    if (i + 1 < indices.length) {
      indices[i].end = raw.indexOf(`---`, indices[i].start + 1);
      if (indices[i].end === -1) indices[i].end = raw.length;
    }
  }

  for (const idx of indices) {
    parts.push({
      heading: idx.heading.trim(),
      body: raw.slice(idx.start, idx.end).trim(),
    });
  }

  // If no section markers found, treat the whole text as a single "Beskjeder" section
  if (parts.length === 0 && raw.trim()) {
    parts.push({ heading: "Beskjeder", body: raw.trim() });
  }

  return parts.map(({ heading, body }) => {
    // Split body into blocks separated by double newlines
    const rawBlocks = body.split(/\n\n+/).filter(Boolean);

    const blocks: Section["blocks"] = [];

    for (const block of rawBlocks) {
      const lines = block.split("\n");
      // Check if first line ends with ":" => subject header
      if (lines[0].endsWith(":") && lines.length > 1) {
        const subject = lines[0].slice(0, -1).trim();
        const items = lines
          .slice(1)
          .map((l) => l.replace(/^\s*•\s*/, "").trim())
          .filter(Boolean);
        blocks.push({ subject, items });
      } else {
        // Plain text block (e.g. Beskjeder messages)
        blocks.push({ subject: null, items: lines.map((l) => l.trim()).filter(Boolean) });
      }
    }

    return { heading, blocks };
  });
}

/* ── Icon + color per section heading ──────────────── */

function getSectionStyle(heading: string) {
  const lower = heading.toLowerCase();
  if (lower.includes("beskjed") || lower.includes("informasjon")) {
    return {
      icon: <Megaphone className="h-4 w-4 text-amber-600" />,
      bg: "bg-amber-50",
      border: "border-amber-100",
    };
  }
  if (lower.includes("læringsmål") || lower.includes("mål")) {
    return {
      icon: <GraduationCap className="h-4 w-4 text-emerald-600" />,
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    };
  }
  if (lower.includes("lekse") || lower.includes("homework")) {
    return {
      icon: <BookOpen className="h-4 w-4 text-blue-600" />,
      bg: "bg-blue-50",
      border: "border-blue-100",
    };
  }
  // Default
  return {
    icon: <Megaphone className="h-4 w-4 text-slate-500" />,
    bg: "bg-slate-50",
    border: "border-slate-100",
  };
}

/* ── Component ─────────────────────────────────────── */

interface WeeklyLetterCardProps {
  contentText: string;
}

export default function WeeklyLetterCard({
  contentText,
}: WeeklyLetterCardProps) {
  const sections = parseSections(contentText);

  if (sections.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          📨 Ukebrev
        </h2>
      </div>

      {/* Sections */}
      <div className="divide-y divide-slate-100">
        {sections.map((section, sIdx) => {
          const style = getSectionStyle(section.heading);

          return (
            <div key={sIdx}>
              {/* Section heading */}
              <div
                className={`px-5 py-3 ${style.bg} flex items-center gap-2 border-b ${style.border}`}
              >
                {style.icon}
                <h3 className="text-sm font-semibold text-slate-700">
                  {section.heading}
                </h3>
              </div>

              {/* Section content */}
              <div className="px-5 py-3 space-y-3">
                {section.blocks.map((block, bIdx) => (
                  <div key={bIdx}>
                    {block.subject && (
                      <p className="text-sm font-medium text-slate-800 mb-1">
                        {block.subject}
                      </p>
                    )}
                    <ul
                      className={
                        block.subject ? "space-y-1 pl-1" : "space-y-1.5"
                      }
                    >
                      {block.items.map((item, iIdx) => (
                        <li
                          key={iIdx}
                          className="text-sm text-slate-600 flex items-start gap-2"
                        >
                          {block.subject ? (
                            <span className="text-slate-300 mt-0.5 select-none">
                              •
                            </span>
                          ) : null}
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
