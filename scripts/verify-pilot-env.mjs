const REQUIRED_VALUES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STUDENT_CODE_PEPPER",
  "PILOT_ENABLED",
];

const failures = [];

for (const name of REQUIRED_VALUES) {
  const value = process.env[name]?.trim();
  if (!value || /^(your-|replace-|change-me|placeholder)/i.test(value)) {
    failures.push(`${name} mangler eller har en plassholderverdi.`);
  }
}

try {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.protocol !== "https:") failures.push("Supabase-URL må bruke HTTPS.");
} catch {
  failures.push("NEXT_PUBLIC_SUPABASE_URL er ikke en gyldig URL.");
}

if ((process.env.STUDENT_CODE_PEPPER?.trim().length ?? 0) < 32) {
  failures.push("STUDENT_CODE_PEPPER må være minst 32 tegn.");
}

if (process.env.PILOT_ENABLED !== "true") {
  failures.push("PILOT_ENABLED må settes eksplisitt til true før oppstart.");
}

for (const flag of [
  "NEXT_PUBLIC_FEATURE_LEGACY_2X",
  "NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS",
  "FEATURE_SMART_IMPORT_AI",
]) {
  if (process.env[flag] !== "false") {
    failures.push(`${flag} skal være eksplisitt false i første pilot.`);
  }
}

if (failures.length > 0) {
  console.error("Pilotmiljøet er ikke klart:\n- " + failures.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Pilotmiljøet har påkrevde variabler og sikre funksjonsflagg.");
}
