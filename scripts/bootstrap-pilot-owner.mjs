import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} mangler.`);
  return value;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const email = required("BOOTSTRAP_OWNER_EMAIL").toLowerCase();
const displayName = required("BOOTSTRAP_OWNER_DISPLAY_NAME");
const organizationName = required("BOOTSTRAP_ORGANIZATION_NAME");
const password = required("BOOTSTRAP_OWNER_PASSWORD");

if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("E-postadressen er ugyldig.");
if (displayName.length > 80) throw new Error("Visningsnavnet er for langt.");
if (organizationName.length > 120) throw new Error("Organisasjonsnavnet er for langt.");
if (password.length < 14 || password.length > 128) {
  throw new Error("Bootstrap-passordet må være mellom 14 og 128 tegn.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;
if (existingUsers.users.some((user) => user.email?.toLowerCase() === email)) {
  throw new Error("En bruker med denne e-postadressen finnes allerede.");
}

let userId = null;
let organizationId = null;

try {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (authError || !authData.user) throw authError ?? new Error("Brukeren ble ikke opprettet.");
  userId = authData.user.id;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({ name: organizationName, created_by: userId })
    .select("id")
    .single();
  if (organizationError || !organization) {
    throw organizationError ?? new Error("Organisasjonen ble ikke opprettet.");
  }
  organizationId = organization.id;

  const { error: membershipError } = await admin.from("memberships").insert({
    organization_id: organizationId,
    user_id: userId,
    role: "owner",
    created_by: userId,
  });
  if (membershipError) throw membershipError;

  console.log(
    `Pilotens eier er opprettet for ${email}. Organisasjons-ID: ${organizationId}.`,
  );
  console.log("Tofaktoroppsett kreves ved første tilgang til lærerflaten.");
} catch (error) {
  if (organizationId) {
    await admin.from("organizations").delete().eq("id", organizationId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
  throw error;
}
