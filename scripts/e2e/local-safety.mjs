const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const LOCAL_SUPABASE_PORT = "54321";

export function assertLocalSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Supabase-URL for E2E er ugyldig.");
  }

  if (
    url.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.port !== LOCAL_SUPABASE_PORT
  ) {
    throw new Error(
      "Autentisert E2E nekter å bruke annet enn lokal Supabase på http://127.0.0.1:54321 eller http://localhost:54321.",
    );
  }

  return url.toString().replace(/\/$/, "");
}
export function parseSupabaseEnv(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const rawValue = match[2].trim();
    values[match[1]] =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;
  }
  return values;
}
