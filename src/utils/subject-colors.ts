/**
 * Centralized color system for school subjects (Skolestudio palette)
 * Ensures consistent colors across all views (Student Dashboard, Subject Pages, Teacher Views)
 *
 * IMPORTANT: All color classes are explicitly defined to ensure Tailwind CSS generates them.
 * Dynamic template literals are NOT used to avoid class purging.
 */

export type SubjectTheme =
  | "slate"
  | "gray"
  | "zinc"
  | "neutral"
  | "stone"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

export interface ColorClasses {
  base: string; // Primary color (bg-red-600)
  light: string; // Light background (bg-red-50)
  border: string; // Border color (border-red-200)
  text: string; // Text color (text-red-700)
  textLight: string; // Light text (text-red-600)
  gradient: string; // Gradient (from-red-500 to-red-600)
  icon: string; // Icon color (text-red-600)
  badge: string; // Badge background (bg-red-100 text-red-700)
  hover: string; // Hover state (hover:bg-red-700)
  progress: string; // Progress bar fill (bg-red-500)
  borderAccent: string; // Thick accent border (border-red-500) — schedule cards
  shadowRgb: string; // RGB triplet for box-shadow glow (e.g. "239, 68, 68")
}

/**
 * Palette mapping - Subject names to their designated colors
 * Based on traditional subject associations
 */
const SUBJECT_PALETTE: Record<string, SubjectTheme> = {
  Norsk: "red",
  Matte: "blue",
  Engelsk: "orange",
  Samfunnsfag: "amber",
  Naturfag: "green",
  KRLE: "purple",
  "K&H": "violet",
  Gym: "rose",
  "M&H": "emerald",
};

/**
 * Explicit color mapping - Every color with all its Tailwind classes explicitly defined
 * This ensures Tailwind CSS properly generates all class utilities (no dynamic template strings)
 */
const COLOR_MAP: Record<SubjectTheme, ColorClasses> = {
  // Neutrals
  slate: {
    base: "bg-slate-600",
    light: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    textLight: "text-slate-600",
    gradient: "from-slate-500 to-slate-600",
    icon: "text-slate-600",
    badge: "bg-slate-100 text-slate-700",
    hover: "hover:bg-slate-700",
    progress: "bg-slate-500",
    borderAccent: "border-slate-500",
    shadowRgb: "100, 116, 139",
  },
  gray: {
    base: "bg-gray-600",
    light: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    textLight: "text-gray-600",
    gradient: "from-gray-500 to-gray-600",
    icon: "text-gray-600",
    badge: "bg-gray-100 text-gray-700",
    hover: "hover:bg-gray-700",
    progress: "bg-gray-500",
    borderAccent: "border-gray-500",
    shadowRgb: "107, 114, 128",
  },
  zinc: {
    base: "bg-zinc-600",
    light: "bg-zinc-50",
    border: "border-zinc-200",
    text: "text-zinc-700",
    textLight: "text-zinc-600",
    gradient: "from-zinc-500 to-zinc-600",
    icon: "text-zinc-600",
    badge: "bg-zinc-100 text-zinc-700",
    hover: "hover:bg-zinc-700",
    progress: "bg-zinc-500",
    borderAccent: "border-zinc-500",
    shadowRgb: "113, 113, 122",
  },
  neutral: {
    base: "bg-neutral-600",
    light: "bg-neutral-50",
    border: "border-neutral-200",
    text: "text-neutral-700",
    textLight: "text-neutral-600",
    gradient: "from-neutral-500 to-neutral-600",
    icon: "text-neutral-600",
    badge: "bg-neutral-100 text-neutral-700",
    hover: "hover:bg-neutral-700",
    progress: "bg-neutral-500",
    borderAccent: "border-neutral-500",
    shadowRgb: "115, 115, 115",
  },
  stone: {
    base: "bg-stone-600",
    light: "bg-stone-50",
    border: "border-stone-200",
    text: "text-stone-700",
    textLight: "text-stone-600",
    gradient: "from-stone-500 to-stone-600",
    icon: "text-stone-600",
    badge: "bg-stone-100 text-stone-700",
    hover: "hover:bg-stone-700",
    progress: "bg-stone-500",
    borderAccent: "border-stone-500",
    shadowRgb: "120, 113, 108",
  },

  // Reds
  red: {
    base: "bg-red-600",
    light: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    textLight: "text-red-600",
    gradient: "from-red-500 to-red-600",
    icon: "text-red-600",
    badge: "bg-red-100 text-red-700",
    hover: "hover:bg-red-700",
    progress: "bg-red-500",
    borderAccent: "border-red-500",
    shadowRgb: "239, 68, 68",
  },
  orange: {
    base: "bg-orange-600",
    light: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    textLight: "text-orange-600",
    gradient: "from-orange-500 to-orange-600",
    icon: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
    hover: "hover:bg-orange-700",
    progress: "bg-orange-500",
    borderAccent: "border-orange-500",
    shadowRgb: "249, 115, 22",
  },
  amber: {
    base: "bg-amber-500",
    light: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    textLight: "text-amber-700",
    gradient: "from-amber-400 to-amber-500",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-800",
    hover: "hover:bg-amber-600",
    progress: "bg-amber-500",
    borderAccent: "border-amber-500",
    shadowRgb: "245, 158, 11",
  },
  yellow: {
    base: "bg-yellow-500",
    light: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    textLight: "text-yellow-700",
    gradient: "from-yellow-400 to-yellow-500",
    icon: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-800",
    hover: "hover:bg-yellow-600",
    progress: "bg-yellow-500",
    borderAccent: "border-yellow-500",
    shadowRgb: "234, 179, 8",
  },

  // Greens
  lime: {
    base: "bg-lime-600",
    light: "bg-lime-50",
    border: "border-lime-200",
    text: "text-lime-700",
    textLight: "text-lime-600",
    gradient: "from-lime-500 to-lime-600",
    icon: "text-lime-600",
    badge: "bg-lime-100 text-lime-700",
    hover: "hover:bg-lime-700",
    progress: "bg-lime-500",
    borderAccent: "border-lime-500",
    shadowRgb: "132, 204, 22",
  },
  green: {
    base: "bg-green-600",
    light: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    textLight: "text-green-600",
    gradient: "from-green-500 to-green-600",
    icon: "text-green-600",
    badge: "bg-green-100 text-green-700",
    hover: "hover:bg-green-700",
    progress: "bg-green-500",
    borderAccent: "border-green-500",
    shadowRgb: "34, 197, 94",
  },
  emerald: {
    base: "bg-emerald-600",
    light: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    textLight: "text-emerald-600",
    gradient: "from-emerald-500 to-emerald-600",
    icon: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    hover: "hover:bg-emerald-700",
    progress: "bg-emerald-500",
    borderAccent: "border-emerald-500",
    shadowRgb: "16, 185, 129",
  },
  teal: {
    base: "bg-teal-600",
    light: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    textLight: "text-teal-600",
    gradient: "from-teal-500 to-teal-600",
    icon: "text-teal-600",
    badge: "bg-teal-100 text-teal-700",
    hover: "hover:bg-teal-700",
    progress: "bg-teal-500",
    borderAccent: "border-teal-500",
    shadowRgb: "20, 184, 166",
  },
  cyan: {
    base: "bg-cyan-600",
    light: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700",
    textLight: "text-cyan-600",
    gradient: "from-cyan-500 to-cyan-600",
    icon: "text-cyan-600",
    badge: "bg-cyan-100 text-cyan-700",
    hover: "hover:bg-cyan-700",
    progress: "bg-cyan-500",
    borderAccent: "border-cyan-500",
    shadowRgb: "6, 182, 212",
  },
  sky: {
    base: "bg-sky-600",
    light: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    textLight: "text-sky-600",
    gradient: "from-sky-500 to-sky-600",
    icon: "text-sky-600",
    badge: "bg-sky-100 text-sky-700",
    hover: "hover:bg-sky-700",
    progress: "bg-sky-500",
    borderAccent: "border-sky-500",
    shadowRgb: "14, 165, 233",
  },
  blue: {
    base: "bg-blue-600",
    light: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    textLight: "text-blue-600",
    gradient: "from-blue-500 to-blue-600",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    hover: "hover:bg-blue-700",
    progress: "bg-blue-500",
    borderAccent: "border-blue-500",
    shadowRgb: "59, 130, 246",
  },

  // Purples
  indigo: {
    base: "bg-indigo-600",
    light: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    textLight: "text-indigo-600",
    gradient: "from-indigo-500 to-indigo-600",
    icon: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700",
    hover: "hover:bg-indigo-700",
    progress: "bg-indigo-500",
    borderAccent: "border-indigo-500",
    shadowRgb: "99, 102, 241",
  },
  violet: {
    base: "bg-violet-600",
    light: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    textLight: "text-violet-600",
    gradient: "from-violet-500 to-violet-600",
    icon: "text-violet-600",
    badge: "bg-violet-100 text-violet-700",
    hover: "hover:bg-violet-700",
    progress: "bg-violet-500",
    borderAccent: "border-violet-500",
    shadowRgb: "139, 92, 246",
  },
  purple: {
    base: "bg-purple-600",
    light: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    textLight: "text-purple-600",
    gradient: "from-purple-500 to-purple-600",
    icon: "text-purple-600",
    badge: "bg-purple-100 text-purple-700",
    hover: "hover:bg-purple-700",
    progress: "bg-purple-500",
    borderAccent: "border-purple-500",
    shadowRgb: "168, 85, 247",
  },
  fuchsia: {
    base: "bg-fuchsia-600",
    light: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    text: "text-fuchsia-700",
    textLight: "text-fuchsia-600",
    gradient: "from-fuchsia-500 to-fuchsia-600",
    icon: "text-fuchsia-600",
    badge: "bg-fuchsia-100 text-fuchsia-700",
    hover: "hover:bg-fuchsia-700",
    progress: "bg-fuchsia-500",
    borderAccent: "border-fuchsia-500",
    shadowRgb: "217, 70, 239",
  },

  // Pinks
  pink: {
    base: "bg-pink-600",
    light: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-700",
    textLight: "text-pink-600",
    gradient: "from-pink-500 to-pink-600",
    icon: "text-pink-600",
    badge: "bg-pink-100 text-pink-700",
    hover: "hover:bg-pink-700",
    progress: "bg-pink-500",
    borderAccent: "border-pink-500",
    shadowRgb: "236, 72, 153",
  },
  rose: {
    base: "bg-rose-600",
    light: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    textLight: "text-rose-600",
    gradient: "from-rose-500 to-rose-600",
    icon: "text-rose-600",
    badge: "bg-rose-100 text-rose-700",
    hover: "hover:bg-rose-700",
    progress: "bg-rose-500",
    borderAccent: "border-rose-500",
    shadowRgb: "244, 63, 94",
  },
};

/**
 * Get the color theme for a subject
 * Accepts either a subject name or a theme string, with optional fallback
 * @param themeString - Subject name (e.g., "Norsk") or theme type (e.g., "red")
 * @param fallback - Optional fallback theme string tried when primary resolves to gray
 * @returns ColorClasses object with all color utilities
 */
export function getSubjectTheme(themeString: string, fallback?: string): ColorClasses {
  // First check if it's a known subject name
  const subjectTheme = SUBJECT_PALETTE[themeString];

  // Use the subject theme, or try the string directly as a theme
  const theme = (subjectTheme || themeString) as SubjectTheme;

  const result = COLOR_MAP[theme];
  if (result && theme !== "gray" as SubjectTheme) return result;

  // Try fallback before giving up
  if (fallback) {
    const fbSubject = SUBJECT_PALETTE[fallback];
    const fbTheme = (fbSubject || fallback) as SubjectTheme;
    return COLOR_MAP[fbTheme] || COLOR_MAP.gray;
  }

  return result || COLOR_MAP.gray;
}

/**
 * Get a light badge version of the theme for secondary elements
 * @param themeString - Subject name or theme type
 * @returns Object with light background and text colors
 */
export function getSubjectBadgeTheme(themeString: string) {
  const theme = getSubjectTheme(themeString);
  return {
    bg: theme.light,
    text: theme.text,
  };
}
