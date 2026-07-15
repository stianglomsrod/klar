import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "./local-safety.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} mangler for lokal E2E.`);
  return value;
}

const IDS = {
  owner: "10000000-0000-4000-8000-000000000001",
  student: "10000000-0000-4000-8000-000000000002",
  organization: "20000000-0000-4000-8000-000000000001",
  class: "30000000-0000-4000-8000-000000000001",
  taskOne: "40000000-0000-4000-8000-000000000001",
  taskTwo: "40000000-0000-4000-8000-000000000002",
  assignmentOne: "50000000-0000-4000-8000-000000000001",
  assignmentTwo: "50000000-0000-4000-8000-000000000002",
};

const url = assertLocalSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"));
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const pepper = required("STUDENT_CODE_PEPPER");
const ownerPassword = required("KLAR_E2E_OWNER_PASSWORD");
const studentPassword = required("KLAR_E2E_STUDENT_PASSWORD");
const studentCode = required("KLAR_E2E_STUDENT_CODE")
  .toUpperCase()
  .replace(/[\s_]+/g, "-");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: blockedSignup, error: blockedSignupError } =
  await publicClient.auth.signUp({
    email: `blocked-${randomBytes(8).toString("hex")}@e2e.klar.invalid`,
    password: `Blocked-${randomBytes(18).toString("base64url")}aA1!`,
  });
if (!blockedSignupError) {
  if (blockedSignup.user) {
    await admin.auth.admin.deleteUser(blockedSignup.user.id);
  }
  throw new Error("Lokal Auth tillot offentlig registrering.");
}

async function createUser(attributes) {
  const { data, error } = await admin.auth.admin.createUser(attributes);
  if (error || !data.user) {
    throw error ?? new Error("Lokal E2E-bruker ble ikke opprettet.");
  }
}

async function insert(table, rows) {
  const { error } = await admin.from(table).insert(rows);
  if (error) throw error;
}

await createUser({
  id: IDS.owner,
  email: "owner@e2e.klar.invalid",
  password: ownerPassword,
  email_confirm: true,
  user_metadata: { display_name: "Testlærer" },
});
await createUser({
  id: IDS.student,
  email: "student@e2e.klar.invalid",
  password: studentPassword,
  email_confirm: true,
  user_metadata: { display_name: "Testelev" },
});

await insert("organizations", {
  id: IDS.organization,
  name: "Klar E2E",
  created_by: IDS.owner,
});
await insert("memberships", [
  {
    organization_id: IDS.organization,
    user_id: IDS.owner,
    role: "owner",
    created_by: IDS.owner,
  },
  {
    organization_id: IDS.organization,
    user_id: IDS.student,
    role: "student",
    created_by: IDS.owner,
  },
]);
await insert("classes", {
  id: IDS.class,
  organization_id: IDS.organization,
  name: "Testklasse 3A",
  academic_year: "2026/2027",
  created_by: IDS.owner,
});
await insert("class_memberships", [
  {
    class_id: IDS.class,
    organization_id: IDS.organization,
    user_id: IDS.owner,
    role: "teacher",
    created_by: IDS.owner,
  },
  {
    class_id: IDS.class,
    organization_id: IDS.organization,
    user_id: IDS.student,
    role: "student",
    created_by: IDS.owner,
  },
]);

const codeDigest = createHmac("sha256", pepper)
  .update(studentCode, "utf8")
  .digest("hex");
await insert("student_login_codes", {
  user_id: IDS.student,
  organization_id: IDS.organization,
  code_digest: codeDigest,
  created_by: IDS.owner,
});

await insert("task_definitions", [
  {
    id: IDS.taskOne,
    organization_id: IDS.organization,
    class_id: IDS.class,
    title: "Les fem linjer",
    description: "Les de fem første linjene i leseboka.",
    subject: "Norsk",
    estimated_minutes: 10,
    support_level: 2,
    position: 0,
    publication_status: "published",
    published_at: "2020-01-01T08:00:00.000Z",
    created_by: IDS.owner,
  },
  {
    id: IDS.taskTwo,
    organization_id: IDS.organization,
    class_id: IDS.class,
    title: "Regn tre stykker",
    description: "Gjør oppgave 1, 2 og 3 i arbeidsboka.",
    subject: "Matematikk",
    estimated_minutes: 15,
    support_level: 2,
    position: 1,
    publication_status: "published",
    published_at: "2020-01-01T08:00:00.000Z",
    created_by: IDS.owner,
  },
]);
await insert("task_assignments", [
  {
    id: IDS.assignmentOne,
    organization_id: IDS.organization,
    class_id: IDS.class,
    task_definition_id: IDS.taskOne,
    student_id: IDS.student,
    assigned_by: IDS.owner,
    visible_from: "2020-01-01T08:00:00.000Z",
    due_at: "2099-12-31T14:00:00.000Z",
  },
  {
    id: IDS.assignmentTwo,
    organization_id: IDS.organization,
    class_id: IDS.class,
    task_definition_id: IDS.taskTwo,
    student_id: IDS.student,
    assigned_by: IDS.owner,
    visible_from: "2020-01-01T08:00:00.000Z",
    due_at: "2099-12-31T14:00:00.000Z",
  },
]);
await insert("student_task_state", {
  assignment_id: IDS.assignmentTwo,
  organization_id: IDS.organization,
  student_id: IDS.student,
  status: "completed",
  started_at: "2020-01-01T08:15:00.000Z",
  completed_at: "2020-01-01T08:25:00.000Z",
});
await insert("student_experience_settings", {
  organization_id: IDS.organization,
  student_id: IDS.student,
  support_level: 2,
  progress_enabled: true,
  updated_by: IDS.owner,
});

console.log("Lokal E2E-fixture er klar med én lærer, én elev og to oppgaver.");
