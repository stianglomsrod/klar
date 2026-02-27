// ── Hero Section Gradient Map ──────────────────────────
// Shared by Container A (subject/[id]) and Container B (lesson/[id]).
// Maps subject theme names (and Norwegian subject names) to CSS gradients.

const heroGradients: Record<string, string> = {
  // Theme names
  red: "linear-gradient(to bottom, rgb(254, 226, 226), rgb(254, 240, 240), white)",
  blue: "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)",
  orange:
    "linear-gradient(to bottom, rgb(254, 231, 207), rgb(254, 245, 230), white)",
  amber:
    "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
  yellow:
    "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
  green:
    "linear-gradient(to bottom, rgb(220, 251, 219), rgb(240, 253, 244), white)",
  purple:
    "linear-gradient(to bottom, rgb(243, 232, 255), rgb(250, 245, 255), white)",
  violet:
    "linear-gradient(to bottom, rgb(237, 235, 254), rgb(245, 243, 255), white)",
  rose: "linear-gradient(to bottom, rgb(255, 228, 230), rgb(255, 245, 247), white)",
  emerald:
    "linear-gradient(to bottom, rgb(209, 250, 229), rgb(240, 253, 250), white)",
  gray: "linear-gradient(to bottom, rgb(229, 231, 235), rgb(249, 250, 251), white)",
  indigo:
    "linear-gradient(to bottom, rgb(224, 231, 255), rgb(238, 242, 255), white)",
  teal: "linear-gradient(to bottom, rgb(204, 251, 241), rgb(240, 253, 250), white)",
  pink: "linear-gradient(to bottom, rgb(252, 231, 243), rgb(253, 242, 248), white)",

  // Norwegian subject names (map to same gradients as their theme)
  Norsk:
    "linear-gradient(to bottom, rgb(254, 226, 226), rgb(254, 240, 240), white)",
  Matte:
    "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)",
  Engelsk:
    "linear-gradient(to bottom, rgb(254, 231, 207), rgb(254, 245, 230), white)",
  Samfunnsfag:
    "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
  Naturfag:
    "linear-gradient(to bottom, rgb(220, 251, 219), rgb(240, 253, 244), white)",
  KRLE: "linear-gradient(to bottom, rgb(243, 232, 255), rgb(250, 245, 255), white)",
  "K&H":
    "linear-gradient(to bottom, rgb(237, 235, 254), rgb(245, 243, 255), white)",
  Gym: "linear-gradient(to bottom, rgb(255, 228, 230), rgb(255, 245, 247), white)",
  "M&H":
    "linear-gradient(to bottom, rgb(209, 250, 229), rgb(240, 253, 250), white)",
  Uteskole:
    "linear-gradient(to bottom, rgb(252, 226, 198), rgb(254, 243, 220), white)",
};

const DEFAULT_GRADIENT =
  "linear-gradient(to bottom, rgb(219, 234, 254), rgb(239, 246, 255), white)";

/**
 * Returns a CSS linear-gradient string for a subject's hero section.
 * Accepts either a theme key (e.g. "red") or a Norwegian subject name (e.g. "Norsk").
 * Falls back to a blue gradient when the key is unknown.
 */
export const getHeroGradient = (theme: string): string =>
  heroGradients[theme] || DEFAULT_GRADIENT;
