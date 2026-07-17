import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "./local-safety.mjs";
import { fixtureSessionPlans } from "./fixture-session-plans.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} mangler for lokal E2E.`);
  return value;
}

const IDS = {
  owner: "10000000-0000-4000-8000-000000000001",
  student: "10000000-0000-4000-8000-000000000002",
  substitute: "10000000-0000-4000-8000-000000000003",
  visualStaff: "10000000-0000-4000-8000-000000000004",
  otherStaff: "10000000-0000-4000-8000-000000000005",
  otherOwner: "10000000-0000-4000-8000-000000000006",
  visualStudent: "10000000-0000-4000-8000-000000000007",
  visualOwner: "10000000-0000-4000-8000-000000000008",
  visualAssignee: "10000000-0000-4000-8000-000000000009",
  otherStudent: "10000000-0000-4000-8000-000000000010",
  returnStudent: "10000000-0000-4000-8000-000000000011",
  helpStudent: "10000000-0000-4000-8000-000000000012",
  lifecycleHelpStudent: "10000000-0000-4000-8000-000000000013",
  helpStaff: "10000000-0000-4000-8000-000000000014",
  organization: "20000000-0000-4000-8000-000000000001",
  otherOrganization: "20000000-0000-4000-8000-000000000002",
  visualControlOrganization: "20000000-0000-4000-8000-000000000003",
  class: "30000000-0000-4000-8000-000000000001",
  visualClass: "30000000-0000-4000-8000-000000000002",
  otherClass: "30000000-0000-4000-8000-000000000003",
  visualControlClass: "30000000-0000-4000-8000-000000000004",
  helpClass: "30000000-0000-4000-8000-000000000005",
};

const url = assertLocalSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"));
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const pepper = required("STUDENT_CODE_PEPPER");
const studentCode = required("KLAR_E2E_STUDENT_CODE")
  .toUpperCase()
  .replace(/[\s_]+/g, "-");
const visualStudentCode = required("KLAR_E2E_VISUAL_STUDENT_CODE")
  .toUpperCase()
  .replace(/[\s_]+/g, "-");

const credentials = {
  owner: {
    email: required("KLAR_E2E_OWNER_EMAIL"),
    password: required("KLAR_E2E_OWNER_PASSWORD"),
  },
  substitute: {
    email: required("KLAR_E2E_SUBSTITUTE_EMAIL"),
    password: required("KLAR_E2E_SUBSTITUTE_PASSWORD"),
  },
  visualStaff: {
    email: required("KLAR_E2E_VISUAL_STAFF_EMAIL"),
    password: required("KLAR_E2E_VISUAL_STAFF_PASSWORD"),
  },
  visualOwner: {
    email: required("KLAR_E2E_VISUAL_OWNER_EMAIL"),
    password: required("KLAR_E2E_VISUAL_OWNER_PASSWORD"),
  },
  otherStaff: {
    email: required("KLAR_E2E_OTHER_STAFF_EMAIL"),
    password: required("KLAR_E2E_OTHER_STAFF_PASSWORD"),
  },
  student: {
    email: "student@e2e.klar.invalid",
    password: required("KLAR_E2E_STUDENT_PASSWORD"),
  },
  visualStudent: {
    email: "visual-student@e2e.klar.invalid",
    password: required("KLAR_E2E_VISUAL_STUDENT_PASSWORD"),
  },
  returnStudent: {
    email: "return-student@e2e.klar.invalid",
    password: required("KLAR_E2E_RETURN_STUDENT_PASSWORD"),
  },
  helpStudent: {
    email: "help-student@e2e.klar.invalid",
    password: required("KLAR_E2E_STUDENT_PASSWORD"),
  },
  helpStaff: {
    email: "help-staff@e2e.klar.invalid",
    password: required("KLAR_E2E_SUBSTITUTE_PASSWORD"),
  },
};

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
  if (blockedSignup.user) await admin.auth.admin.deleteUser(blockedSignup.user.id);
  throw new Error("Lokal Auth tillot offentlig registrering.");
}

async function createUser({ id, email, password, displayName }) {
  const { data, error } = await admin.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    throw error ?? new Error("Lokal E2E-bruker ble ikke opprettet.");
  }
}

async function insert(table, rows) {
  const { error } = await admin.from(table).insert(rows);
  if (error) throw error;
}

async function createAssignment({
  organizationId,
  ownerId,
  userId,
  classId,
  jobLabel,
  key,
  startsAt = "2020-01-01T00:00:00.000Z",
  endsAt = "2099-12-31T23:59:59.000Z",
}) {
  const { data, error } = await admin.rpc("create_staff_assignment", {
    p_organization_id: organizationId,
    p_actor_id: ownerId,
    p_target_user_id: userId,
    p_class_id: classId,
    p_job_label: jobLabel,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_idempotency_key: key,
  });
  if (error || !data) throw error ?? new Error("E2E-assignment ble ikke opprettet.");
  return data;
}

async function revokeAssignment({ organizationId, ownerId, assignmentId }) {
  const { error } = await admin.rpc("revoke_staff_assignment", {
    p_organization_id: organizationId,
    p_actor_id: ownerId,
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
}

async function publishTask({
  classId,
  actorId,
  staffAssignmentId,
  studentId,
  title,
  description,
  subject,
  estimatedMinutes,
  visibleFrom = "2020-01-01T08:00:00.000Z",
  dueAt = "2099-12-31T14:00:00.000Z",
}) {
  const { data: taskId, error } = await admin.rpc("publish_task_to_class", {
    p_class_id: classId,
    p_actor_id: actorId,
    p_staff_assignment_id: staffAssignmentId,
    p_title: title,
    p_description: description,
    p_subject: subject,
    p_estimated_minutes: estimatedMinutes,
    p_support_level: 2,
    p_visible_from: visibleFrom,
    p_due_at: dueAt,
  });
  if (error || !taskId) {
    throw error ?? new Error("E2E-oppgaven ble ikke publisert.");
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("task_assignments")
    .select("id")
    .eq("task_definition_id", taskId)
    .eq("student_id", studentId)
    .single();
  if (assignmentError || !assignment) {
    throw assignmentError ?? new Error("E2E-oppgaveiterasjonen mangler.");
  }
  return { taskId, assignmentId: assignment.id };
}

async function publishWeeklyPlanFixture({
  classId,
  actorId,
  staffAssignmentId,
  keyPrefix,
  titlePrefix,
}) {
  if (process.env.TZ !== "Europe/Oslo") {
    throw new Error("Lokal E2E-ukeplan krever TZ=Europe/Oslo.");
  }
  const plans = fixtureSessionPlans();
  let globalIndex = 0;
  let sessionCount = 0;
  let taskCount = 0;

  for (const [planIndex, plan] of plans.entries()) {
    const sessions = plan.windows.map((window) => {
      globalIndex += 1;
      const presentationKey = window.presentationKey;
      const subject = presentationKey === "next" ? "Matematikk" : "Norsk";
      return {
        logical_key: `${keyPrefix}1000000-0000-4000-8000-${String(globalIndex).padStart(12, "0")}`,
        title:
          presentationKey === "previous"
            ? `${titlePrefix} lesestund`
            : presentationKey === "current"
              ? `${titlePrefix} arbeidsøkt`
              : `${titlePrefix} matematikk`,
        subject,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        tasks: [
          {
            logical_key: `${keyPrefix}2000000-0000-4000-8000-${String(globalIndex).padStart(12, "0")}`,
            title:
              presentationKey === "current"
                ? `${titlePrefix} øktoppgave`
                : `${titlePrefix} ${presentationKey === "previous" ? "leseoppgave" : "regneoppgave"}`,
            description: "Syntetisk oppgave i en autoritativ undervisningsøkt.",
            subject,
            estimated_minutes: 10,
            support_level: 2,
          },
        ],
      };
    });
    const candidate = { schema_version: "weekly_plan_v1", sessions };
    const semanticHash = createHash("sha256")
      .update(JSON.stringify(candidate), "utf8")
      .digest("hex");
    const { data, error } = await admin.rpc("publish_initial_weekly_plan", {
      p_class_id: classId,
      p_actor_id: actorId,
      p_staff_assignment_id: staffAssignmentId,
      p_week_start_date: plan.weekStartDate,
      p_timezone_name: "Europe/Oslo",
      p_expected_lock_version: 0,
      p_request_id: `${keyPrefix}3000000-0000-4000-8000-${String(planIndex + 1).padStart(12, "0")}`,
      p_semantic_hash: semanticHash,
      p_candidate: candidate,
    });
    if (error || !data) {
      throw error ?? new Error("E2E-ukeplanen ble ikke publisert.");
    }
    sessionCount += sessions.length;
    taskCount += sessions.length;
  }

  return { sessionCount, taskCount };
}

async function publishQueueOnlyPlan({
  classId,
  actorId,
  staffAssignmentId,
  keyPrefix,
}) {
  const plan = fixtureSessionPlans().find((candidate) =>
    candidate.windows.some((window) => window.presentationKey === "current"),
  );
  const currentWindow = plan?.windows.find(
    (window) => window.presentationKey === "current",
  );
  if (!plan || !currentWindow) {
    throw new Error("E2E-fixturen mangler en aktuell undervisningsøkt.");
  }
  const candidate = {
    schema_version: "weekly_plan_v1",
    sessions: [
      {
        logical_key: `${keyPrefix}1000000-0000-4000-8000-000000000001`,
        title: "Aktuell hjelpekøøkt",
        subject: "Norsk",
        starts_at: currentWindow.startsAt,
        ends_at: currentWindow.endsAt,
        tasks: [],
      },
    ],
  };
  const semanticHash = createHash("sha256")
    .update(JSON.stringify(candidate), "utf8")
    .digest("hex");
  const { error } = await admin.rpc("publish_initial_weekly_plan", {
    p_class_id: classId,
    p_actor_id: actorId,
    p_staff_assignment_id: staffAssignmentId,
    p_week_start_date: plan.weekStartDate,
    p_timezone_name: "Europe/Oslo",
    p_expected_lock_version: 0,
    p_request_id: `${keyPrefix}3000000-0000-4000-8000-000000000001`,
    p_semantic_hash: semanticHash,
    p_candidate: candidate,
  });
  if (error) throw error;
}

async function openCurrentHelpQueue({
  classId,
  actorId,
  staffAssignmentId,
  keyPrefix,
  studentId,
}) {
  const now = new Date().toISOString();
  const { data: session, error: sessionError } = await admin
    .from("plan_revision_sessions")
    .select("id")
    .eq("class_id", classId)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at")
    .limit(1)
    .single();
  if (sessionError || !session) {
    throw sessionError ?? new Error("Aktuell E2E-økt mangler.");
  }
  const { data: queue, error: queueError } = await admin.rpc(
    "open_help_queue_session",
    {
      p_class_id: classId,
      p_revision_session_id: session.id,
      p_actor_id: actorId,
      p_staff_assignment_id: staffAssignmentId,
      p_request_id: `${keyPrefix}4000000-0000-4000-8000-000000000001`,
    },
  );
  if (queueError || !queue || typeof queue.queue_session_id !== "string") {
    throw queueError ?? new Error("E2E-hjelpekøen ble ikke åpnet.");
  }
  if (!studentId) return null;
  const { data: request, error: requestError } = await admin.rpc(
    "request_student_help_v2",
    {
      p_queue_session_id: queue.queue_session_id,
      p_student_id: studentId,
      p_request_id: `${keyPrefix}5000000-0000-4000-8000-000000000001`,
      p_task_assignment_id: null,
    },
  );
  if (requestError || !request || typeof request.request_id !== "string") {
    throw requestError ?? new Error("E2E-hjelpeforespørselen mangler.");
  }
  return request.request_id;
}

await Promise.all([
  createUser({ id: IDS.owner, ...credentials.owner, displayName: "Testeier" }),
  createUser({ id: IDS.student, ...credentials.student, displayName: "Testelev" }),
  createUser({ id: IDS.substitute, ...credentials.substitute, displayName: "Livsløpsvikar" }),
  createUser({ id: IDS.visualStaff, ...credentials.visualStaff, displayName: "Visuell faglærer" }),
  createUser({ id: IDS.helpStaff, ...credentials.helpStaff, displayName: "Hjelpelærer" }),
  createUser({ id: IDS.otherStaff, ...credentials.otherStaff, displayName: "Ansatt annen skole" }),
  createUser({
    id: IDS.otherStudent,
    email: "other-student@e2e.klar.invalid",
    password: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    displayName: "Elev ved annen skole",
  }),
  createUser({
    id: IDS.otherOwner,
    email: "other-owner@e2e.klar.invalid",
    password: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    displayName: "Eier annen skole",
  }),
  createUser({
    id: IDS.visualStudent,
    ...credentials.visualStudent,
    displayName: "Visuell elev",
  }),
  createUser({
    id: IDS.visualOwner,
    ...credentials.visualOwner,
    displayName: "Visuell eier",
  }),
  createUser({
    id: IDS.visualAssignee,
    email: "visual-assignee@e2e.klar.invalid",
    password: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    displayName: "Visuell ansatt",
  }),
  createUser({
    id: IDS.returnStudent,
    ...credentials.returnStudent,
    displayName: "Returelev",
  }),
  createUser({
    id: IDS.helpStudent,
    ...credentials.helpStudent,
    displayName: "Hjelpeelev",
  }),
  createUser({
    id: IDS.lifecycleHelpStudent,
    email: "lifecycle-help-student@e2e.klar.invalid",
    password: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    displayName: "Livsløpselev",
  }),
]);

await insert("organizations", [
  { id: IDS.organization, name: "Klar E2E", created_by: IDS.owner },
  {
    id: IDS.otherOrganization,
    name: "Annen E2E-skole",
    created_by: IDS.otherOwner,
  },
  {
    id: IDS.visualControlOrganization,
    name: "Visuell kontrollskole",
    created_by: IDS.visualOwner,
  },
]);
await insert("memberships", [
  { organization_id: IDS.organization, user_id: IDS.owner, role: "owner", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.student, role: "student", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.substitute, role: "teacher", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.visualStaff, role: "teacher", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.helpStaff, role: "teacher", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.visualStudent, role: "student", created_by: IDS.owner },
  { organization_id: IDS.otherOrganization, user_id: IDS.otherOwner, role: "owner", created_by: IDS.otherOwner },
  { organization_id: IDS.otherOrganization, user_id: IDS.otherStaff, role: "teacher", created_by: IDS.otherOwner },
  { organization_id: IDS.otherOrganization, user_id: IDS.otherStudent, role: "student", created_by: IDS.otherOwner },
  { organization_id: IDS.visualControlOrganization, user_id: IDS.visualOwner, role: "owner", created_by: IDS.visualOwner },
  { organization_id: IDS.visualControlOrganization, user_id: IDS.visualAssignee, role: "teacher", created_by: IDS.visualOwner },
  { organization_id: IDS.organization, user_id: IDS.returnStudent, role: "student", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.helpStudent, role: "student", created_by: IDS.owner },
  { organization_id: IDS.organization, user_id: IDS.lifecycleHelpStudent, role: "student", created_by: IDS.owner },
]);
await insert("classes", [
  {
    id: IDS.class,
    organization_id: IDS.organization,
    name: "Testklasse 3A",
    academic_year: "2026/2027",
    created_by: IDS.owner,
  },
  {
    id: IDS.visualClass,
    organization_id: IDS.organization,
    name: "Visuell klasse 4B",
    academic_year: "2026/2027",
    created_by: IDS.owner,
  },
  {
    id: IDS.otherClass,
    organization_id: IDS.otherOrganization,
    name: "Annen skole 5C",
    academic_year: "2026/2027",
    created_by: IDS.otherOwner,
  },
  {
    id: IDS.visualControlClass,
    organization_id: IDS.visualControlOrganization,
    name: "Visuell kontrollklasse 6D",
    academic_year: "2026/2027",
    created_by: IDS.visualOwner,
  },
  {
    id: IDS.helpClass,
    organization_id: IDS.organization,
    name: "Hjelpekøklasse 5D",
    academic_year: "2026/2027",
    created_by: IDS.owner,
  },
]);
await insert("class_memberships", [
  { class_id: IDS.class, organization_id: IDS.organization, user_id: IDS.student, role: "student", created_by: IDS.owner },
  { class_id: IDS.visualClass, organization_id: IDS.organization, user_id: IDS.visualStudent, role: "student", created_by: IDS.owner },
  { class_id: IDS.otherClass, organization_id: IDS.otherOrganization, user_id: IDS.otherStudent, role: "student", created_by: IDS.otherOwner },
  { class_id: IDS.helpClass, organization_id: IDS.organization, user_id: IDS.helpStudent, role: "student", created_by: IDS.owner },
]);

const { data: visualOperationalClass, error: visualOperationalClassError } =
  await admin.rpc("create_class_for_teacher", {
    p_organization_id: IDS.visualControlOrganization,
    p_actor_id: IDS.visualOwner,
    p_name: "Visuell systemklasse 7E",
    p_academic_year: "2026/2027",
  });
if (visualOperationalClassError || !visualOperationalClass) {
  throw visualOperationalClassError ?? new Error("Systemklassen for visuell QA mangler.");
}

const ownerStaffAssignment = await createAssignment({
  organizationId: IDS.organization,
  ownerId: IDS.owner,
  userId: IDS.owner,
  classId: IDS.class,
  jobLabel: "contact_teacher",
  key: "60000000-0000-4000-8000-000000000001",
});
const visualStaffAssignment = await createAssignment({
  organizationId: IDS.organization,
  ownerId: IDS.owner,
  userId: IDS.visualStaff,
  classId: IDS.visualClass,
  jobLabel: "subject_teacher",
  key: "60000000-0000-4000-8000-000000000002",
});
const otherStaffAssignment = await createAssignment({
  organizationId: IDS.otherOrganization,
  ownerId: IDS.otherOwner,
  userId: IDS.otherStaff,
  classId: IDS.otherClass,
  jobLabel: "substitute",
  key: "60000000-0000-4000-8000-000000000003",
});
const helpOwnerStaffAssignment = await createAssignment({
  organizationId: IDS.organization,
  ownerId: IDS.owner,
  userId: IDS.owner,
  classId: IDS.helpClass,
  jobLabel: "contact_teacher",
  key: "60000000-0000-4000-8000-000000000008",
});
await createAssignment({
  organizationId: IDS.organization,
  ownerId: IDS.owner,
  userId: IDS.helpStaff,
  classId: IDS.helpClass,
  jobLabel: "substitute",
  key: "60000000-0000-4000-8000-000000000009",
});
await createAssignment({
  organizationId: IDS.visualControlOrganization,
  ownerId: IDS.visualOwner,
  userId: IDS.visualAssignee,
  classId: IDS.visualControlClass,
  jobLabel: "contact_teacher",
  key: "60000000-0000-4000-8000-000000000004",
});
await createAssignment({
  organizationId: IDS.visualControlOrganization,
  ownerId: IDS.visualOwner,
  userId: IDS.visualAssignee,
  classId: IDS.visualControlClass,
  jobLabel: "subject_teacher",
  startsAt: "2098-01-01T00:00:00.000Z",
  endsAt: "2099-01-01T00:00:00.000Z",
  key: "60000000-0000-4000-8000-000000000005",
});
await createAssignment({
  organizationId: IDS.visualControlOrganization,
  ownerId: IDS.visualOwner,
  userId: IDS.visualAssignee,
  classId: IDS.visualControlClass,
  jobLabel: "special_educator",
  startsAt: "2020-01-01T00:00:00.000Z",
  endsAt: "2021-01-01T00:00:00.000Z",
  key: "60000000-0000-4000-8000-000000000006",
});
const visualRevokedAssignment = await createAssignment({
  organizationId: IDS.visualControlOrganization,
  ownerId: IDS.visualOwner,
  userId: IDS.visualAssignee,
  classId: IDS.visualControlClass,
  jobLabel: "substitute",
  key: "60000000-0000-4000-8000-000000000007",
});
await revokeAssignment({
  organizationId: IDS.visualControlOrganization,
  ownerId: IDS.visualOwner,
  assignmentId: visualRevokedAssignment,
});

const codeDigest = createHmac("sha256", pepper)
  .update(studentCode, "utf8")
  .digest("hex");
const visualStudentCodeDigest = createHmac("sha256", pepper)
  .update(visualStudentCode, "utf8")
  .digest("hex");
await insert("student_login_codes", [
  {
    user_id: IDS.student,
    organization_id: IDS.organization,
    code_digest: codeDigest,
    created_by: IDS.owner,
  },
  {
    user_id: IDS.visualStudent,
    organization_id: IDS.organization,
    code_digest: visualStudentCodeDigest,
    created_by: IDS.owner,
  },
]);

const primaryWeeklyPlan = await publishWeeklyPlanFixture({
  classId: IDS.class,
  actorId: IDS.owner,
  staffAssignmentId: ownerStaffAssignment,
  keyPrefix: "a",
  titlePrefix: "Dagens",
});
const visualWeeklyPlan = await publishWeeklyPlanFixture({
  classId: IDS.visualClass,
  actorId: IDS.visualStaff,
  staffAssignmentId: visualStaffAssignment,
  keyPrefix: "b",
  titlePrefix: "Visuell",
});
const helpWeeklyPlan = await publishWeeklyPlanFixture({
  classId: IDS.helpClass,
  actorId: IDS.owner,
  staffAssignmentId: helpOwnerStaffAssignment,
  keyPrefix: "d",
  titlePrefix: "Hjelp",
});
await publishQueueOnlyPlan({
  classId: IDS.otherClass,
  actorId: IDS.otherStaff,
  staffAssignmentId: otherStaffAssignment,
  keyPrefix: "c",
});
await Promise.all([
  openCurrentHelpQueue({
    classId: IDS.class,
    actorId: IDS.owner,
    staffAssignmentId: ownerStaffAssignment,
    keyPrefix: "a",
  }),
  openCurrentHelpQueue({
    classId: IDS.visualClass,
    actorId: IDS.visualStaff,
    staffAssignmentId: visualStaffAssignment,
    keyPrefix: "b",
  }),
  openCurrentHelpQueue({
    classId: IDS.otherClass,
    actorId: IDS.otherStaff,
    staffAssignmentId: otherStaffAssignment,
    keyPrefix: "c",
    studentId: IDS.otherStudent,
  }),
]);

await publishTask({
  classId: IDS.class,
  actorId: IDS.owner,
  staffAssignmentId: ownerStaffAssignment,
  studentId: IDS.student,
  title: "Les fem linjer",
  description: "Les de fem første linjene i leseboka.",
  subject: "Norsk",
  estimatedMinutes: 10,
});
const taskTwo = await publishTask({
  classId: IDS.class,
  actorId: IDS.owner,
  staffAssignmentId: ownerStaffAssignment,
  studentId: IDS.student,
  title: "Regn tre stykker",
  description: "Gjør oppgave 1, 2 og 3 i arbeidsboka.",
  subject: "Matematikk",
  estimatedMinutes: 15,
});
await publishTask({
  classId: IDS.visualClass,
  actorId: IDS.visualStaff,
  staffAssignmentId: visualStaffAssignment,
  studentId: IDS.visualStudent,
  title: "Visuell arbeidsoppgave",
  description: "Syntetisk og stabil visuell fixture.",
  subject: "Samfunnsfag",
  estimatedMinutes: 12,
});
const visualReturnTask = await publishTask({
  classId: IDS.visualClass,
  actorId: IDS.visualStaff,
  staffAssignmentId: visualStaffAssignment,
  studentId: IDS.visualStudent,
  title: "Visuell oppgave for retur",
  description: "Syntetisk fullført fixture for responsiv returkontroll.",
  subject: "Norsk",
  estimatedMinutes: 6,
});
await publishTask({
  classId: IDS.otherClass,
  actorId: IDS.otherStaff,
  staffAssignmentId: otherStaffAssignment,
  studentId: IDS.otherStudent,
  title: "Oppgave ved annen skole",
  description: "Syntetisk oppgave for kapabilitetstesting.",
  subject: "Norsk",
  estimatedMinutes: 10,
});

const { error: positionError } = await admin
  .from("task_definitions")
  .update({ position: 1 })
  .eq("id", taskTwo.taskId);
if (positionError) throw positionError;

const { data: visualCompletion, error: visualCompletionError } = await admin.rpc(
  "complete_student_task",
  {
    p_assignment_id: visualReturnTask.assignmentId,
    p_student_id: IDS.visualStudent,
    p_request_id: "80000000-0000-4000-8000-000000000003",
  },
);
if (
  visualCompletionError ||
  !visualCompletion ||
  visualCompletion.status !== "completed" ||
  visualCompletion.xp_balance !== 10
) {
  throw visualCompletionError ?? new Error("Visuell retur-fixture er inkonsistent.");
}

const { data: completedSeed, error: completedSeedError } = await admin.rpc(
  "complete_student_task",
  {
    p_assignment_id: taskTwo.assignmentId,
    p_student_id: IDS.student,
    p_request_id: "80000000-0000-4000-8000-000000000001",
  },
);
if (
  completedSeedError ||
  !completedSeed ||
  completedSeed.status !== "completed" ||
  completedSeed.xp_balance !== 10
) {
  throw completedSeedError ?? new Error("Fullført B1-fixture er inkonsistent.");
}

await insert("class_memberships", [
  {
    class_id: IDS.class,
    organization_id: IDS.organization,
    user_id: IDS.returnStudent,
    role: "student",
    created_by: IDS.owner,
  },
  {
    class_id: IDS.class,
    organization_id: IDS.organization,
    user_id: IDS.lifecycleHelpStudent,
    role: "student",
    created_by: IDS.owner,
  },
  {
    class_id: IDS.helpClass,
    organization_id: IDS.organization,
    user_id: IDS.lifecycleHelpStudent,
    role: "student",
    created_by: IDS.owner,
  },
]);
const returnTask = await publishTask({
  classId: IDS.class,
  actorId: IDS.owner,
  staffAssignmentId: ownerStaffAssignment,
  studentId: IDS.returnStudent,
  title: "Oppgave klar for retur",
  description: "Syntetisk oppgave for trygg returflyt.",
  subject: "Norsk",
  estimatedMinutes: 8,
});
const { data: returnCompletion, error: returnCompletionError } = await admin.rpc(
  "complete_student_task",
  {
    p_assignment_id: returnTask.assignmentId,
    p_student_id: IDS.returnStudent,
    p_request_id: "80000000-0000-4000-8000-000000000002",
  },
);
if (
  returnCompletionError ||
  !returnCompletion ||
  returnCompletion.status !== "completed" ||
  returnCompletion.xp_balance !== 10
) {
  throw returnCompletionError ?? new Error("Retur-fixturen er inkonsistent.");
}
await insert("student_experience_settings", [
  {
    organization_id: IDS.organization,
    student_id: IDS.student,
    support_level: 2,
    progress_enabled: true,
    updated_by: IDS.owner,
  },
  {
    organization_id: IDS.organization,
    student_id: IDS.visualStudent,
    support_level: 2,
    progress_enabled: false,
    updated_by: IDS.visualStaff,
  },
  {
    organization_id: IDS.otherOrganization,
    student_id: IDS.otherStudent,
    support_level: 2,
    progress_enabled: true,
    updated_by: IDS.otherStaff,
  },
  {
    organization_id: IDS.organization,
    student_id: IDS.returnStudent,
    support_level: 2,
    progress_enabled: true,
    updated_by: IDS.owner,
  },
  {
    organization_id: IDS.organization,
    student_id: IDS.helpStudent,
    support_level: 2,
    progress_enabled: false,
    updated_by: IDS.owner,
  },
]);

const [
  statesResult,
  attemptsResult,
  transitionsResult,
  ledgerResult,
  progressResult,
  receiptsResult,
] = await Promise.all([
  admin.from("student_task_state").select("assignment_id, status"),
  admin
    .from("task_completion_attempts")
    .select("id")
    .eq("assignment_id", taskTwo.assignmentId),
  admin
    .from("task_state_transitions")
    .select("id, command")
    .eq("assignment_id", taskTwo.assignmentId),
  admin
    .from("student_xp_ledger")
    .select("entry_kind, points_delta")
    .eq("assignment_id", taskTwo.assignmentId),
  admin
    .from("student_progress")
    .select("xp_balance, current_level, highest_level")
    .eq("organization_id", IDS.organization)
    .eq("student_id", IDS.student)
    .single(),
  admin
    .from("progress_command_receipts")
    .select("command")
    .eq("actor_id", IDS.student)
    .eq("request_id", "80000000-0000-4000-8000-000000000001"),
]);
const seedReadError = [
  statesResult.error,
  attemptsResult.error,
  transitionsResult.error,
  ledgerResult.error,
  progressResult.error,
  receiptsResult.error,
].find(Boolean);
if (seedReadError) throw seedReadError;

const assignedStates = statesResult.data.filter(
  (state) => state.status === "assigned",
).length;
const completedStates = statesResult.data.filter(
  (state) => state.status === "completed",
).length;
const ledgerBalance = ledgerResult.data.reduce(
  (sum, entry) => sum + entry.points_delta,
  0,
);
const plannedAssignmentCount =
  primaryWeeklyPlan.taskCount + visualWeeklyPlan.taskCount + helpWeeklyPlan.taskCount;
// Five task definitions are published while their classes have one student.
// The final return fixture is intentionally class-wide after two more students
// have joined the primary class, so that publication creates three assignments.
const manuallyPublishedAssignmentCount = 5 + 3;
const completedFixtureCount = 3;
const expectedAssignedCount =
  plannedAssignmentCount + manuallyPublishedAssignmentCount - completedFixtureCount;
if (
  statesResult.data.length !==
    manuallyPublishedAssignmentCount + plannedAssignmentCount ||
  assignedStates !== expectedAssignedCount ||
  completedStates !== completedFixtureCount ||
  attemptsResult.data.length !== 1 ||
  transitionsResult.data.length !== 1 ||
  transitionsResult.data[0]?.command !== "complete" ||
  ledgerResult.data.length !== 1 ||
  ledgerResult.data[0]?.entry_kind !== "credit" ||
  ledgerBalance !== 10 ||
  progressResult.data.xp_balance !== ledgerBalance ||
  progressResult.data.current_level !== 1 ||
  progressResult.data.highest_level !== 1 ||
  receiptsResult.data.length !== 1 ||
  receiptsResult.data[0]?.command !== "complete"
) {
  throw new Error(
    `B1-fixturen besto ikke konsistenskontrollen: ${JSON.stringify({
      totalStates: statesResult.data.length,
      assignedStates,
      completedStates,
      plannedAssignmentCount,
      attempts: attemptsResult.data.length,
      transitions: transitionsResult.data,
      ledger: ledgerResult.data,
      ledgerBalance,
      progress: progressResult.data,
      receipts: receiptsResult.data,
    })}`,
  );
}

console.log("Lokal E2E-fixture er klar med isolerte owner-, vikar-, visual-, help-queue- og other-org-data.");
