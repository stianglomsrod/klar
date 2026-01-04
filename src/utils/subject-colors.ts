/**
 * Centralized color system for school subjects (Skolestudio palette)
 * Ensures consistent colors across all views (Student Dashboard, Subject Pages, Teacher Views)
 */

export type SubjectTheme =
  | "red"
  | "blue"
  | "orange"
  | "amber"
  | "green"
  | "purple"
  | "violet"
  | "rose"
  | "emerald"
  | "gray";

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
 * Color theme definitions for all supported themes
 */
const COLOR_THEMES: Record<SubjectTheme, ColorClasses> = {
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
  },
  amber: {
    base: "bg-amber-600",
    light: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    textLight: "text-amber-600",
    gradient: "from-amber-500 to-amber-600",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    hover: "hover:bg-amber-700",
    progress: "bg-amber-500",
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
  },
};

/**
 * Get the color theme for a subject
 * Accepts either a subject name or a theme string
 * @param themeString - Subject name (e.g., "Norsk") or theme type (e.g., "red")
 * @returns ColorClasses object with all color utilities
 */
export function getSubjectTheme(themeString: string): ColorClasses {
  // First check if it's a known subject name
  const subjectTheme = SUBJECT_PALETTE[themeString];

  // Use the subject theme, or try the string directly as a theme, or default to gray
  const theme = (subjectTheme || themeString || "gray") as SubjectTheme;

  return COLOR_THEMES[theme] || COLOR_THEMES.gray;
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
