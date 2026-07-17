import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type APIResponse,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { assertLocalSupabaseUrl } from "../../../scripts/e2e/local-safety.mjs";
import { openLocalDatabase } from "../support/local-database";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const organizationId = "20000000-0000-4000-8000-000000000001";
const classId = "30000000-0000-4000-8000-000000000001";
const otherClassId = "30000000-0000-4000-8000-000000000003";
const ownerId = "10000000-0000-4000-8000-000000000001";
const studentId = "10000000-0000-4000-8000-000000000002";
const substituteId = "10000000-0000-4000-8000-000000000003";
const otherStaffId = "10000000-0000-4000-8000-000000000005";
const protectedAssignmentKey = "60000000-0000-4000-8000-000000000080";
const forgedClassName = "Forfalsket kontrollklasse A1";
const forgedStudentName = "Forfalsket kontrollelev A1";

type CapturedAction = {
  url: string;
  headers: Record<string, string>;
  args: unknown[];
};

type ActorCase = {
  name: string;
  context: BrowserContext;
  redirectPath?: string;
  denialText?: string;
};

async function withDeadline<T>(
  label: string,
  operation: Promise<T>,
  timeoutMs = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} overskred ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function state(name: string) {
  return path.join(authDirectory, name);
}

type ReactTrackedInput = HTMLInputElement & { _valueTracker?: unknown };

async function waitForControlledInputHydration(input: Locator) {
  await expect
    .poll(
      () =>
        input.evaluate((node) =>
          Boolean((node as ReactTrackedInput)._valueTracker),
        ),
      {
        timeout: 10_000,
        message: "Kontrollert input ble ikke hydrert",
      },
    )
    .toBe(true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function captureNextServerAction(
  page: Page,
  label: string,
  trigger: () => Promise<void>,
): Promise<CapturedAction> {
  let captured = false;
  let resolveCapture!: (value: CapturedAction) => void;
  const capture = new Promise<CapturedAction>((resolve) => {
    resolveCapture = resolve;
  });
  const handler = async (route: Route) => {
    const request = route.request();
    const allHeaders = await request.allHeaders();
    if (
      !captured &&
      request.method() === "POST" &&
      typeof allHeaders["next-action"] === "string"
    ) {
      captured = true;
      const contentType = allHeaders["content-type"] ?? "";
      if (!contentType.startsWith("text/plain")) {
        throw new Error("Server Action-protokollen er ikke lenger JSON-basert.");
      }
      const body = request.postData();
      let args: unknown;
      try {
        args = JSON.parse(body ?? "");
      } catch {
        throw new Error("Server Action-argumentene kunne ikke dekodes som JSON.");
      }
      if (!Array.isArray(args)) {
        throw new Error("Server Action-argumentene har uventet form.");
      }
      const headers: Record<string, string> = {};
      for (const name of [
        "accept",
        "content-type",
        "next-action",
        "next-router-state-tree",
        "next-url",
        "x-deployment-id",
      ]) {
        const value = allHeaders[name];
        if (value) headers[name] = value;
      }
      resolveCapture({ url: request.url(), headers, args });
      await route.abort("blockedbyclient");
      return;
    }
    try {
      await route.continue();
    } catch (error) {
      // A revalidation request can be cancelled by the aborted Server Action
      // while this route callback is already queued. That request is not the
      // captured action and must not make the security assertion flaky.
      if (
        !(error instanceof Error) ||
        !error.message.includes("Route is already handled")
      ) {
        throw error;
      }
    }
  };

  await page.route("**/*", handler);
  try {
    return await withDeadline(
      `${label}: fangst av Server Action`,
      (async () => {
        await trigger();
        return await capture;
      })(),
      20_000,
    );
  } finally {
    await page.unroute("**/*", handler);
  }
}

async function replayAction(
  context: BrowserContext,
  baseURL: string,
  action: CapturedAction,
  args = action.args,
): Promise<APIResponse> {
  return context.request.fetch(action.url, {
    method: "POST",
    headers: {
      ...action.headers,
      origin: new URL(baseURL).origin,
    },
    data: JSON.stringify(args),
    maxRedirects: 0,
    timeout: 15_000,
  });
}

async function expectActionDenial(
  response: APIResponse,
  actor: ActorCase,
  caseName: string,
) {
  if (actor.redirectPath) {
    expect(response.status(), `${caseName}: forventet proxy-nekt`).toBe(307);
    const location = response.headers().location;
    expect(location, `${caseName}: redirect mangler`).toBeTruthy();
    expect(new URL(location!, "http://127.0.0.1").pathname).toBe(
      actor.redirectPath,
    );
    return;
  }

  expect(response.status(), `${caseName}: action svarte ikke kontrollert`).toBe(
    200,
  );
  expect(response.headers()["content-type"]).toContain("text/x-component");
  const body = await withDeadline(
    `${caseName}: lesing av action-respons`,
    response.text(),
  );
  expect(
    Boolean(actor.denialText && body.includes(actor.denialText)),
    `${caseName}: forventet strukturert autorisasjonsnekt`,
  ).toBe(true);
}

async function expectActionFailure(
  response: APIResponse,
  expectedText: string,
  caseName: string,
) {
  expect(response.status(), `${caseName}: action svarte ikke kontrollert`).toBe(
    200,
  );
  expect(response.headers()["content-type"]).toContain("text/x-component");
  const body = await withDeadline(
    `${caseName}: lesing av action-respons`,
    response.text(),
  );
  expect(
    body.includes(expectedText),
    `${caseName}: forventet valideringsfeil mangler`,
  ).toBe(true);
}

test("kontrollhandlinger avviser forfalskede aktører og ugyldige oppdrag", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const apiUrl = assertLocalSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Lokal service-role-nøkkel mangler.");
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const owner = await browser.newContext({
    baseURL,
    storageState: state("owner-aal2.json"),
  });
  const actors: ActorCase[] = [
    {
      name: "owner-aal1",
      context: await browser.newContext({
        baseURL,
        storageState: state("owner-aal1.json"),
      }),
      redirectPath: "/v3/mfa/challenge",
    },
    {
      name: "ordinary-staff",
      context: await browser.newContext({
        baseURL,
        storageState: state("substitute-aal2.json"),
      }),
      denialText: "Du har ikke tilgang til denne organisasjonen.",
    },
    {
      name: "student",
      context: await browser.newContext({
        baseURL,
        storageState: state("student.json"),
      }),
      redirectPath: "/login",
    },
    {
      name: "other-org-owner",
      context: await browser.newContext({
        baseURL,
        storageState: state("visual-owner-aal2.json"),
      }),
      denialText: "Du har ikke tilgang til denne organisasjonen.",
    },
  ];

  try {
    const ownerAccessPage = await owner.newPage();
    await ownerAccessPage.goto("/v3/teacher/access");
    await ownerAccessPage.getByRole("button", { name: "Gi tilgang" }).click();
    const createDialog = ownerAccessPage.getByRole("dialog", {
      name: "Gi tilgang",
    });
    await createDialog
      .getByLabel("Ansatt")
      .selectOption({ label: "Testeier" });
    await createDialog
      .getByLabel("Rolle i oppdraget")
      .selectOption("substitute");
    await createDialog
      .getByLabel("Klasse")
      .selectOption({ label: "Testklasse 3A" });
    const createAssignmentAction = await captureNextServerAction(
      ownerAccessPage,
      "opprett assignment",
      () =>
        createDialog
          .getByRole("button", { name: "Bekreft oppdrag" })
          .click(),
    );
    expect(createAssignmentAction.args).toHaveLength(1);
    const createInput = createAssignmentAction.args[0];
    if (!isRecord(createInput)) {
      throw new Error("Oppdragsargumentet har uventet form.");
    }

    await Promise.all(
      actors.map(async (actor) => {
        const input = {
          ...createInput,
          ...(actor.name === "ordinary-staff"
            ? { targetUserId: substituteId }
            : {}),
        };
        const response = await replayAction(
          actor.context,
          baseURL,
          createAssignmentAction,
          [input],
        );
        await expectActionDenial(
          response,
          actor,
          `create-assignment/${actor.name}`,
        );
      }),
    );

    const startsAt = String(createInput.startsAt);
    const endsAt = String(createInput.endsAt);
    const withoutEndsAt = { ...createInput };
    delete withoutEndsAt.endsAt;
    const withoutIdempotency = { ...createInput };
    delete withoutIdempotency.idempotencyKey;
    const withoutStartsAt = { ...createInput };
    delete withoutStartsAt.startsAt;
    const invalidCases: Array<{
      name: string;
      input: Record<string, unknown>;
      error: string;
    }> = [
      {
        name: "student-target",
        input: { ...createInput, targetUserId: studentId },
        error: "Kunne ikke opprette oppdraget.",
      },
      {
        name: "other-org-target",
        input: { ...createInput, targetUserId: otherStaffId },
        error: "Kunne ikke opprette oppdraget.",
      },
      {
        name: "other-org-class",
        input: { ...createInput, classId: otherClassId },
        error: "Kunne ikke opprette oppdraget.",
      },
      {
        name: "equal-end",
        input: { ...createInput, endsAt: startsAt },
        error: "Sluttidspunktet må være etter starttidspunktet.",
      },
      {
        name: "end-before-start",
        input: { ...createInput, startsAt: endsAt, endsAt: startsAt },
        error: "Sluttidspunktet må være etter starttidspunktet.",
      },
      {
        name: "missing-end",
        input: withoutEndsAt,
        error: "Sluttidspunktet må være etter starttidspunktet.",
      },
      {
        name: "invalid-start",
        input: { ...createInput, startsAt: "ikke-en-dato" },
        error: "Sluttidspunktet må være etter starttidspunktet.",
      },
      {
        name: "missing-start",
        input: withoutStartsAt,
        error: "Sluttidspunktet må være etter starttidspunktet.",
      },
      {
        name: "invalid-end",
        input: { ...createInput, endsAt: "ikke-en-dato" },
        error: "Sluttidspunktet må være etter starttidspunktet.",
      },
      {
        name: "legacy-label",
        input: { ...createInput, jobLabel: "legacy_teacher" },
        error: "Velg en gyldig jobbetikett.",
      },
      {
        name: "owner-label",
        input: { ...createInput, jobLabel: "operational_owner" },
        error: "Velg en gyldig jobbetikett.",
      },
      {
        name: "unknown-label",
        input: { ...createInput, jobLabel: "ukjent" },
        error: "Velg en gyldig jobbetikett.",
      },
      {
        name: "invalid-organization",
        input: { ...createInput, organizationId: "ikke-uuid" },
        error: "Organisasjons-ID er ugyldig.",
      },
      {
        name: "invalid-target",
        input: { ...createInput, targetUserId: "ikke-uuid" },
        error: "Ansatt-ID er ugyldig.",
      },
      {
        name: "invalid-class",
        input: { ...createInput, classId: "ikke-uuid" },
        error: "Klasse-ID er ugyldig.",
      },
      {
        name: "missing-idempotency",
        input: withoutIdempotency,
        error: "Idempotensnøkkel er ugyldig.",
      },
      {
        name: "invalid-idempotency",
        input: { ...createInput, idempotencyKey: "ikke-uuid" },
        error: "Idempotensnøkkel er ugyldig.",
      },
    ];

    // A bounded batch keeps WebKit's shared APIRequestContext from saturating
    // one Server Action connection while retaining a fast negative matrix.
    for (let index = 0; index < invalidCases.length; index += 4) {
      await Promise.all(
        invalidCases.slice(index, index + 4).map(async (invalid) => {
          const response = await replayAction(
            owner,
            baseURL,
            createAssignmentAction,
            [invalid.input],
          );
          await expectActionFailure(response, invalid.error, invalid.name);
        }),
      );
    }

    const capturedIdempotencyKey = String(createInput.idempotencyKey);
    const { count: invalidAssignmentCount, error: invalidAssignmentError } =
      await admin
        .from("staff_assignments")
        .select("id", { count: "exact", head: true })
        .eq("idempotency_key", capturedIdempotencyKey);
    if (invalidAssignmentError) throw invalidAssignmentError;
    expect(invalidAssignmentCount).toBe(0);

    const { data: protectedAssignment, error: protectedAssignmentError } =
      await admin.rpc("create_staff_assignment", {
        p_organization_id: organizationId,
        p_actor_id: ownerId,
        p_target_user_id: ownerId,
        p_class_id: classId,
        p_job_label: "subject_teacher",
        p_starts_at: "2020-01-01T00:00:00.000Z",
        p_ends_at: "2099-12-31T23:59:59.000Z",
        p_idempotency_key: protectedAssignmentKey,
      });
    if (protectedAssignmentError || !protectedAssignment) {
      throw protectedAssignmentError ?? new Error("Testoppdraget mangler.");
    }

    const revokePage = await owner.newPage();
    await revokePage.goto("/v3/teacher/access");
    const protectedRow = revokePage
      .getByRole("listitem")
      .filter({ hasText: "Testeier" })
      .filter({ hasText: "Faglærer" })
      .filter({ hasText: "Testklasse 3A" });
    await expect(protectedRow).toHaveCount(1);
    await protectedRow
      .getByRole("button", { name: "Trekk tilbake" })
      .click();
    const revokeDialog = revokePage.getByRole("dialog", {
      name: "Trekk tilbake oppdrag?",
    });
    const revokeAction = await captureNextServerAction(
      revokePage,
      "tilbakekall assignment",
      () =>
        revokeDialog.getByRole("button", { name: "Trekk tilbake" }).click(),
    );
    await Promise.all(
      actors.map(async (actor) => {
        const response = await replayAction(
          actor.context,
          baseURL,
          revokeAction,
        );
        await expectActionDenial(response, actor, `revoke/${actor.name}`);
      }),
    );

    const [{ data: assignmentAfter }, { count: revokeAudits }] =
      await Promise.all([
        admin
          .from("staff_assignments")
          .select("revoked_at, revoked_by")
          .eq("id", protectedAssignment)
          .single(),
        admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "staff_assignment.revoked")
          .eq("entity_id", protectedAssignment),
      ]);
    expect(assignmentAfter).toEqual({ revoked_at: null, revoked_by: null });
    expect(revokeAudits).toBe(0);

    const classPage = await owner.newPage();
    await classPage.goto("/v3/teacher");
    await classPage.waitForLoadState("networkidle");
    const forgedClassNameInput = classPage.getByLabel("Klassenavn");
    const forgedAcademicYearInput = classPage.getByLabel("Skoleår");
    await Promise.all([
      waitForControlledInputHydration(forgedClassNameInput),
      waitForControlledInputHydration(forgedAcademicYearInput),
    ]);
    await forgedClassNameInput.fill(forgedClassName);
    await forgedAcademicYearInput.fill("2026/2027");
    await expect(forgedClassNameInput).toHaveValue(forgedClassName);
    await expect(forgedAcademicYearInput).toHaveValue("2026/2027");
    const createClassAction = await captureNextServerAction(
      classPage,
      "opprett klasse",
      () =>
        classPage.getByRole("button", { name: "Opprett", exact: true }).click(),
    );
    expect(createClassAction.args).toEqual([
      {
        organizationId,
        name: forgedClassName,
        academicYear: "2026/2027",
      },
    ]);
    await Promise.all(
      actors.map(async (actor) => {
        const response = await replayAction(
          actor.context,
          baseURL,
          createClassAction,
        );
        await expectActionDenial(
          response,
          actor,
          `create-class/${actor.name}`,
        );
      }),
    );
    const { count: forgedClasses, error: forgedClassError } = await admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("name", forgedClassName);
    if (forgedClassError) throw forgedClassError;
    expect(forgedClasses).toBe(0);

    const studentPage = await owner.newPage();
    await studentPage.goto(`/v3/teacher/classes/${classId}`);
    await studentPage.waitForLoadState("networkidle");
    const forgedStudentNameInput = studentPage.getByLabel("Visningsnavn");
    await waitForControlledInputHydration(forgedStudentNameInput);
    await forgedStudentNameInput.fill(forgedStudentName);
    await expect(forgedStudentNameInput).toHaveValue(forgedStudentName);
    const createStudentAction = await captureNextServerAction(
      studentPage,
      "opprett prototypeelev",
      () =>
        studentPage
          .getByRole("button", { name: "Opprett elev", exact: true })
          .click(),
    );
    await Promise.all(
      actors.map(async (actor) => {
        const response = await replayAction(
          actor.context,
          baseURL,
          createStudentAction,
        );
        const expectedActor =
          actor.name === "other-org-owner"
            ? { ...actor, denialText: "Klassen finnes ikke i organisasjonen." }
            : actor;
        await expectActionDenial(
          response,
          expectedActor,
          `create-student/${actor.name}`,
        );
      }),
    );
    const { count: forgedStudents, error: forgedStudentError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("display_name", forgedStudentName);
    if (forgedStudentError) throw forgedStudentError;
    expect(forgedStudents).toBe(0);
  } finally {
    await Promise.all([owner.close(), ...actors.map((actor) => actor.context.close())]);
  }
});

test("owner AAL2 oppretter klasse og prototypeelev gjennom kontrollflaten", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const apiUrl = assertLocalSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const studentCodePepper = process.env.STUDENT_CODE_PEPPER;
  if (!serviceRoleKey || !studentCodePepper) {
    throw new Error("Lokale QA-hemmeligheter mangler.");
  }

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const database = await openLocalDatabase();
  const context = await browser.newContext({
    baseURL,
    storageState: state("owner-aal2.json"),
  });
  const token = randomUUID().slice(0, 8);
  const className = `E2E ownerklasse ${token}`;
  const studentName = `E2E kontrollelev ${token}`;
  let createdClassId: string | null = null;
  let createdAssignmentId: string | null = null;
  let createdStudentId: string | null = null;
  let studentContext: BrowserContext | null = null;
  let studentCode = "";
  let temporaryPassword = "";

  try {
    const page = await context.newPage();
    await page.goto("/v3/teacher");
    await expect(page).not.toHaveURL(/\/v3\/mfa\//);
    await page.waitForLoadState("networkidle");
    const classNameInput = page.getByLabel("Klassenavn");
    const academicYearInput = page.getByLabel("Skoleår");
    await Promise.all([
      waitForControlledInputHydration(classNameInput),
      waitForControlledInputHydration(academicYearInput),
    ]);
    await classNameInput.fill(className);
    await academicYearInput.fill("2026/2027");
    await expect(classNameInput).toHaveValue(className);
    await expect(academicYearInput).toHaveValue("2026/2027");
    await Promise.all([
      page.waitForURL(/\/v3\/teacher\/classes\/[0-9a-f-]{36}$/, {
        timeout: 20_000,
      }),
      page.getByRole("button", { name: "Opprett", exact: true }).click(),
    ]);
    createdClassId = new URL(page.url()).pathname.split("/").at(-1) ?? null;
    expect(
      Boolean(
        createdClassId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            createdClassId,
          ),
      ),
    ).toBe(true);
    await expect(page.getByRole("heading", { name: className })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Legg til prototypeelev" }),
    ).toBeVisible();

    const classRows = await database.query<{
      id: string;
      organization_id: string;
      name: string;
      academic_year: string;
      created_by: string;
      xmin: string;
    }>(
      `
        select
          id::text,
          organization_id::text,
          name,
          academic_year,
          created_by::text,
          xmin::text
        from public.classes
        where id = $1::uuid
      `,
      [createdClassId],
    );
    expect(classRows.rows).toHaveLength(1);
    expect(classRows.rows[0]).toMatchObject({
      id: createdClassId,
      organization_id: organizationId,
      name: className,
      academic_year: "2026/2027",
      created_by: ownerId,
    });

    const membershipRows = await database.query<{
      user_id: string;
      role: string;
      created_by: string;
      xmin: string;
    }>(
      `
        select user_id::text, role::text, created_by::text, xmin::text
        from public.class_memberships
        where class_id = $1::uuid
          and user_id = $2::uuid
      `,
      [createdClassId, ownerId],
    );
    expect(membershipRows.rows).toEqual([
      expect.objectContaining({
        user_id: ownerId,
        role: "teacher",
        created_by: ownerId,
      }),
    ]);

    const assignmentRows = await database.query<{
      id: string;
      organization_id: string;
      user_id: string;
      job_label: string;
      profile_version: string;
      source: string;
      ends_at: string | null;
      revoked_at: string | null;
      xmin: string;
    }>(
      `
        select
          assignment.id::text,
          assignment.organization_id::text,
          assignment.user_id::text,
          assignment.job_label::text,
          assignment.profile_version,
          assignment.source::text,
          assignment.ends_at::text,
          assignment.revoked_at::text,
          assignment.xmin::text
        from public.staff_assignments as assignment
        join public.staff_assignment_class_scopes as scope
          on scope.assignment_id = assignment.id
        where scope.class_id = $1::uuid
          and assignment.user_id = $2::uuid
      `,
      [createdClassId, ownerId],
    );
    expect(assignmentRows.rows).toHaveLength(1);
    const ownerAssignment = assignmentRows.rows[0];
    createdAssignmentId = ownerAssignment.id;
    expect(ownerAssignment).toMatchObject({
      organization_id: organizationId,
      user_id: ownerId,
      job_label: "operational_owner",
      profile_version: "class_pedagogy_v2",
      source: "class_creation",
      ends_at: null,
      revoked_at: null,
    });

    const scopeRows = await database.query<{ xmin: string }>(
      `
        select xmin::text
        from public.staff_assignment_class_scopes
        where assignment_id = $1::uuid
          and organization_id = $2::uuid
          and class_id = $3::uuid
      `,
      [ownerAssignment.id, organizationId, createdClassId],
    );
    expect(scopeRows.rows).toHaveLength(1);

    const capabilityRows = await database.query<{
      capability: string;
      profile_version: string;
      xmin: string;
    }>(
      `
        select capability::text, profile_version, xmin::text
        from public.staff_assignment_capabilities
        where assignment_id = $1::uuid
        order by capability
      `,
      [ownerAssignment.id],
    );
    const requiredA1Capabilities = [
      "class.workspace.read",
      "help_queue.manage",
      "plan.preview",
      "plan.publish",
      "student_progress.read",
      "student_support.update",
      "task.publish",
      "task.return",
    ];
    expect(
      capabilityRows.rows.map(({ capability, profile_version }) => ({
        capability,
        profile_version,
      })),
    ).toEqual(
      [...requiredA1Capabilities]
        .sort()
        .map((capability) => ({
          capability,
          profile_version: "class_pedagogy_v2",
        })),
    );

    const auditRows = await database.query<{
      event_name: string;
      entity_type: string;
      entity_id: string;
      actor_id: string;
      authorizing_staff_assignment_id: string | null;
      authorizing_capability: string | null;
      metadata: Record<string, unknown>;
      xmin: string;
    }>(
      `
        select
          event_name,
          entity_type,
          entity_id::text,
          actor_id::text,
          authorizing_staff_assignment_id::text,
          authorizing_capability::text,
          metadata,
          xmin::text
        from public.audit_events
        where (event_name = 'class.created' and entity_id = $1::uuid)
           or (event_name = 'staff_assignment.created' and entity_id = $2::uuid)
        order by event_name
      `,
      [createdClassId, ownerAssignment.id],
    );
    expect(auditRows.rows).toHaveLength(2);
    expect(
      auditRows.rows.find((row) => row.event_name === "class.created"),
    ).toMatchObject({
      entity_type: "class",
      entity_id: createdClassId,
      actor_id: ownerId,
      authorizing_staff_assignment_id: null,
      authorizing_capability: null,
      metadata: expect.objectContaining({
        operational_owner_assignment_id: ownerAssignment.id,
      }),
    });
    expect(
      auditRows.rows.find(
        (row) => row.event_name === "staff_assignment.created",
      ),
    ).toMatchObject({
      entity_type: "staff_assignment",
      entity_id: ownerAssignment.id,
      actor_id: ownerId,
      authorizing_staff_assignment_id: null,
      authorizing_capability: null,
      metadata: expect.objectContaining({
        target_user_id: ownerId,
        class_id: createdClassId,
        job_label: "operational_owner",
        source: "class_creation",
      }),
    });
    expect(
      new Set([
        classRows.rows[0].xmin,
        membershipRows.rows[0].xmin,
        ownerAssignment.xmin,
        scopeRows.rows[0].xmin,
        ...capabilityRows.rows.map((row) => row.xmin),
        ...auditRows.rows.map((row) => row.xmin),
      ]).size,
    ).toBe(1);

    const studentNameInput = page.getByLabel("Visningsnavn");
    await waitForControlledInputHydration(studentNameInput);
    await studentNameInput.fill(studentName);
    await expect(studentNameInput).toHaveValue(studentName);
    await page
      .getByRole("button", { name: "Opprett elev", exact: true })
      .click();
    const createdStatus = page.getByRole("status");
    await expect(
      createdStatus.locator("p").filter({ hasText: `${studentName} er opprettet` }),
    ).toHaveText(`${studentName} er opprettet`);
    await expect(createdStatus.getByText("Elevkode", { exact: true })).toBeVisible();
    await expect(
      createdStatus.getByText("Midlertidig passord", { exact: true }),
    ).toBeVisible();
    const credentialValues = createdStatus.locator("dd");
    await expect(credentialValues).toHaveCount(2);
    studentCode = (await credentialValues.nth(0).textContent())?.trim() ?? "";
    temporaryPassword =
      (await credentialValues.nth(1).textContent())?.trim() ?? "";
    expect(/^[A-Z]+-[A-Z]+-[0-9]{4}$/.test(studentCode)).toBe(true);
    expect(/^[A-Za-z]+-[A-Za-z]+-[0-9]{4}$/.test(temporaryPassword)).toBe(
      true,
    );
    await credentialValues.evaluateAll((values) => {
      for (const value of values) value.textContent = "Skjult etter kontroll";
    });
    await expect(page.getByText(studentName, { exact: true })).toBeVisible();

    const studentRows = await database.query<{
      id: string;
      display_name: string;
      membership_role: string;
      membership_created_by: string;
      class_role: string;
      class_created_by: string;
    }>(
      `
        select
          profile.id::text,
          profile.display_name,
          membership.role::text as membership_role,
          membership.created_by::text as membership_created_by,
          class_membership.role::text as class_role,
          class_membership.created_by::text as class_created_by
        from public.profiles as profile
        join public.memberships as membership
          on membership.user_id = profile.id
         and membership.organization_id = $1::uuid
        join public.class_memberships as class_membership
          on class_membership.user_id = profile.id
         and class_membership.organization_id = $1::uuid
         and class_membership.class_id = $2::uuid
        where profile.display_name = $3
      `,
      [organizationId, createdClassId, studentName],
    );
    expect(studentRows.rows).toHaveLength(1);
    createdStudentId = studentRows.rows[0].id;
    expect(studentRows.rows[0]).toMatchObject({
      display_name: studentName,
      membership_role: "student",
      membership_created_by: ownerId,
      class_role: "student",
      class_created_by: ownerId,
    });

    const loginCodeRows = await database.query<{
      organization_id: string;
      user_id: string;
      code_digest: string;
      created_by: string;
    }>(
      `
        select
          organization_id::text,
          user_id::text,
          code_digest,
          created_by::text
        from public.student_login_codes
        where user_id = $1::uuid
      `,
      [createdStudentId],
    );
    expect(loginCodeRows.rows).toHaveLength(1);
    const expectedDigest = createHmac("sha256", studentCodePepper)
      .update(studentCode.trim().toUpperCase().replace(/[\s_]+/g, "-"), "utf8")
      .digest("hex");
    expect(loginCodeRows.rows[0]).toMatchObject({
      organization_id: organizationId,
      user_id: createdStudentId,
      code_digest: expectedDigest,
      created_by: ownerId,
    });

    const studentAuditRows = await database.query<{
      actor_id: string;
      metadata: Record<string, unknown>;
    }>(
      `
        select actor_id::text, metadata
        from public.audit_events
        where event_name = 'student.created'
          and entity_type = 'profile'
          and entity_id = $1::uuid
      `,
      [createdStudentId],
    );
    expect(studentAuditRows.rows).toEqual([
      expect.objectContaining({
        actor_id: ownerId,
        metadata: expect.objectContaining({ class_id: createdClassId }),
      }),
    ]);

    studentContext = await browser.newContext({ baseURL });
    const studentLoginPage = await studentContext.newPage();
    await studentLoginPage.goto("/login", { waitUntil: "networkidle" });
    await studentLoginPage.evaluate(
      async ({ identifier, password }) => {
        const setInput = (id: string, value: string) => {
          const input = document.getElementById(id);
          if (!(input instanceof HTMLInputElement)) {
            throw new Error(`Innloggingsfeltet ${id} mangler.`);
          }
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set;
          if (!setter) throw new Error("Kunne ikke skrive innloggingsfeltet.");
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setInput("identifier", identifier);
        setInput("password", password);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      },
      { identifier: studentCode, password: temporaryPassword },
    );
    const studentLoginAction = studentLoginPage.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        Boolean(request.headers()["next-action"]),
      { timeout: 10_000 },
    );
    await Promise.all([
      studentLoginAction,
      studentLoginPage.waitForURL(/\/v3\/student$/, {
        timeout: 20_000,
        waitUntil: "commit",
      }),
      studentLoginPage
        .getByRole("button", { name: "Logg inn", exact: true })
        .click(),
    ]);
    await expect(
      studentLoginPage.getByRole("heading", {
        name: `Hei, ${studentName}`,
        exact: true,
      }),
    ).toBeVisible();
    const usedCode = await database.query<{ last_used_at: string | null }>(
      `
        select last_used_at::text
        from public.student_login_codes
        where user_id = $1::uuid
      `,
      [createdStudentId],
    );
    expect(usedCode.rows).toHaveLength(1);
    expect(usedCode.rows[0].last_used_at).not.toBeNull();
    studentCode = "";
    temporaryPassword = "";
  } finally {
    studentCode = "";
    temporaryPassword = "";
    const cleanupErrors: unknown[] = [];
    const attemptCleanup = async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(error);
      }
    };

    await attemptCleanup(async () => {
      if (studentContext) await studentContext.close();
    });
    await attemptCleanup(async () => {
      if (!createdStudentId && createdClassId) {
        const lookup = await database.query<{ id: string }>(
          `
            select profile.id::text
            from public.profiles as profile
            join public.class_memberships as membership
              on membership.user_id = profile.id
             and membership.class_id = $1::uuid
            where profile.display_name = $2
          `,
          [createdClassId, studentName],
        );
        if (lookup.rows.length > 1) {
          throw new Error("Flere syntetiske elever matchet oppryddingen.");
        }
        createdStudentId = lookup.rows[0]?.id ?? null;
      }
    });
    await attemptCleanup(async () => {
      if (!createdStudentId) return;
      const { error } = await admin.auth.admin.deleteUser(createdStudentId);
      if (error) throw error;
    });
    await attemptCleanup(async () => {
      if (!createdClassId) return;

      const assignmentLookup = await database.query<{ id: string }>(
        `
          select assignment.id::text
          from public.staff_assignments as assignment
          join public.staff_assignment_class_scopes as scope
            on scope.assignment_id = assignment.id
          where scope.class_id = $1::uuid
            and assignment.user_id = $2::uuid
            and assignment.source = 'class_creation'
            and assignment.job_label = 'operational_owner'
          order by assignment.id
        `,
        [createdClassId, ownerId],
      );
      const assignmentIds = Array.from(
        new Set(
          [createdAssignmentId, ...assignmentLookup.rows.map((row) => row.id)].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      );
      const auditEntityIds = [
        createdClassId,
        ...(createdStudentId ? [createdStudentId] : []),
        ...assignmentIds,
      ];

      await database.query("begin");
      try {
        await database.query("set local session_replication_role = replica");
        await database.query(
          "delete from public.audit_events where entity_id = any($1::uuid[])",
          [auditEntityIds],
        );
        if (assignmentIds.length > 0) {
          await database.query(
            "delete from public.staff_assignment_capabilities where assignment_id = any($1::uuid[])",
            [assignmentIds],
          );
          await database.query(
            "delete from public.staff_assignment_class_scopes where assignment_id = any($1::uuid[])",
            [assignmentIds],
          );
          await database.query(
            "delete from public.staff_assignments where id = any($1::uuid[])",
            [assignmentIds],
          );
        }
        await database.query(
          "delete from public.class_memberships where class_id = $1::uuid",
          [createdClassId],
        );
        await database.query(
          "delete from public.classes where id = $1::uuid",
          [createdClassId],
        );
        await database.query("commit");
      } catch (error) {
        await database.query("rollback");
        throw error;
      }
    });
    await attemptCleanup(async () => context.close());
    await attemptCleanup(async () => database.end());

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        "Lokal opprydding etter owner-kontrollflyten feilet.",
      );
    }
  }
});
