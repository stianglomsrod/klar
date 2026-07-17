import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} mangler.`);
  return value;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const studentId = required("PILOT_STUDENT_ID");
const confirmation = required("CONFIRM_DELETE_STUDENT_ID");

if (studentId !== confirmation) {
  throw new Error("CONFIRM_DELETE_STUDENT_ID må være identisk med PILOT_STUDENT_ID.");
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
  throw new Error("PILOT_STUDENT_ID er ikke en gyldig UUID.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: memberships, error: membershipError } = await admin
  .from("memberships")
  .select("role")
  .eq("user_id", studentId);
if (membershipError) throw membershipError;
if (memberships.length === 0 || memberships.some((membership) => membership.role !== "student")) {
  throw new Error("Brukeren finnes ikke som en entydig pilot-elev. Ingen data ble slettet.");
}

const { error } = await admin.auth.admin.deleteUser(studentId);
if (error) throw error;
console.log(`Pilot-elev ${studentId} og tilknyttede elevdata er slettet.`);
