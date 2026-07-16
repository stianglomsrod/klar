import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type APIResponse,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import { assertLocalSupabaseUrl } from "../../../scripts/e2e/local-safety.mjs";

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
    await classPage.getByLabel("Klassenavn").fill(forgedClassName);
    await classPage.getByLabel("Skoleår").fill("2026/2027");
    const createClassAction = await captureNextServerAction(
      classPage,
      "opprett klasse",
      () =>
        classPage.getByRole("button", { name: "Opprett", exact: true }).click(),
    );
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
    await studentPage.getByLabel("Visningsnavn").fill(forgedStudentName);
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
