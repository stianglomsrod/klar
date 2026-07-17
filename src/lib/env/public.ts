export type PublicSupabaseEnvironment = {
  url: string;
  anonKey: string;
};

function requirePublicValue(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Mangler miljovariabelen ${name}. Se .env.example for nodvendig konfigurasjon.`,
    );
  }

  return value;
}

/**
 * Public values that are safe to expose to the browser bundle.
 * Keep the direct process.env references here so Next.js can inline them.
 */
export function getPublicSupabaseEnvironment(): PublicSupabaseEnvironment {
  return {
    url: requirePublicValue(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    anonKey: requirePublicValue(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

export function isLegacy2xEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_LEGACY_2X === "true";
}

export function isPilotEnabled(): boolean {
  return process.env.PILOT_ENABLED !== "false";
}
