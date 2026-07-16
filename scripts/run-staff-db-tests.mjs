import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenario =
  process.argv.find((argument) => argument.startsWith("--scenario="))?.split("=")[1] ??
  "all";

if (!["all", "empty", "upgrade"].includes(scenario)) {
  throw new Error("Database-scenario må være all, empty eller upgrade.");
}

const preA1Migrations = [
  "20260714000000_initial_core.sql",
  "20260714000001_authorization.sql",
  "20260714000002_prototype_auth.sql",
  "20260714000003_core_operations.sql",
  "20260714000004_help_queue_operations.sql",
  "20260714000005_plan_import_operations.sql",
  "20260714000006_student_experience.sql",
];
const a1Migration = "20260715000000_staff_assignments.sql";
const a1FollowupMigrations = [
  "20260715000001_staff_support_read_hardening.sql",
];
const activeContainers = new Set();

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    stdio: options.inherit ? "inherit" : [options.input ? "pipe" : "ignore", "pipe", "pipe"],
    shell: false,
    timeout: options.timeout ?? 120_000,
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw result.error ?? new Error(`docker ${args[0]} feilet: ${detail.slice(-4_000)}`);
  }
  return (result.stdout ?? "").trim();
}

function cleanupContainer(name) {
  if (!activeContainers.delete(name)) return;
  spawnSync("docker", ["rm", "-f", name], {
    cwd: root,
    stdio: "ignore",
    shell: false,
    timeout: 30_000,
  });
}

function cleanupAll() {
  for (const name of [...activeContainers]) cleanupContainer(name);
}

process.once("SIGINT", () => {
  cleanupAll();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanupAll();
  process.exit(143);
});

function startContainer(label) {
  const suffix = randomBytes(5).toString("hex");
  const name = `klar-a1-${label}-${process.pid}-${suffix}`;
  const password = `synthetic-${randomBytes(18).toString("base64url")}`;
  runDocker([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-p",
    "127.0.0.1::5432",
    "postgres:17",
  ]);
  activeContainers.add(name);

  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const probe = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], {
      cwd: root,
      stdio: "ignore",
      shell: false,
      timeout: 5_000,
    });
    if (!probe.error && probe.status === 0) {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!ready) throw new Error(`Lokal PostgreSQL-container ${name} ble ikke klar.`);

  const mapping = runDocker(["port", name, "5432/tcp"]);
  const port = Number(mapping.match(/127\.0\.0\.1:(\d+)/)?.[1]);
  if (!Number.isInteger(port) || port < 1) {
    throw new Error(`Docker publiserte ikke PostgreSQL på loopback: ${mapping}`);
  }
  return {
    name,
    config: {
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    },
  };
}

function sqlPath(relativePath) {
  return path.join(root, relativePath);
}

function runSql(containerName, relativePath, { expectFailure = false } = {}) {
  const sql = readFileSync(sqlPath(relativePath), "utf8");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      cwd: root,
      encoding: "utf8",
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      timeout: 120_000,
    },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (expectFailure) {
    assert.notEqual(result.status, 0, `${relativePath} skulle ha feilet.`);
    return output;
  }
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${relativePath} feilet:\n${output.slice(-6_000)}`);
  }
  return output;
}

function applyPreA1(containerName) {
  runSql(containerName, "supabase/verification/bootstrap_supabase_stub.sql");
  for (const migration of preA1Migrations) {
    runSql(containerName, `supabase/migrations/${migration}`);
  }
}

function applyA1Followups(containerName) {
  for (const migration of a1FollowupMigrations) {
    runSql(containerName, `supabase/migrations/${migration}`);
  }
}

async function withClient(config, applicationName, callback) {
  const client = new Client({ ...config, application_name: applicationName });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function synchronizedPair(config, label, first, second) {
  const lockKey = 1_000_000 + Math.floor(Math.random() * 1_000_000_000);
  const firstName = `klar-a1-${label}-first`;
  const secondName = `klar-a1-${label}-second`;
  const coordinator = new Client({ ...config, application_name: `klar-a1-${label}-coordinator` });
  const firstClient = new Client({ ...config, application_name: firstName });
  const secondClient = new Client({ ...config, application_name: secondName });
  await Promise.all([coordinator.connect(), firstClient.connect(), secondClient.connect()]);
  try {
    await coordinator.query("select pg_advisory_lock($1)", [lockKey]);
    await Promise.all([firstClient.query("begin"), secondClient.query("begin")]);

    const runWorker = async (client, operation) => {
      try {
        await client.query("select pg_advisory_xact_lock_shared($1)", [lockKey]);
        const result = await operation(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    };

    const firstPromise = runWorker(firstClient, first);
    const secondPromise = runWorker(secondClient, second);
    let waiting = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = await coordinator.query(
        `select count(*)::integer as count
         from pg_stat_activity
         where application_name = any($1::text[])
           and wait_event = 'advisory'`,
        [[firstName, secondName]],
      );
      if (result.rows[0].count === 2) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(waiting, true, `${label}: begge databasesesjoner nådde ikke startbarrieren.`);
    await coordinator.query("select pg_advisory_unlock($1)", [lockKey]);
    return await Promise.allSettled([firstPromise, secondPromise]);
  } finally {
    await Promise.allSettled([firstClient.end(), secondClient.end(), coordinator.end()]);
  }
}

async function runConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const ownerId = "a0000000-0000-4000-8000-000000000001";
  const retryUserId = "a0000000-0000-4000-8000-000000000002";
  const revokeUserId = "a0000000-0000-4000-8000-000000000003";
  const raceUserId = "a0000000-0000-4000-8000-000000000004";
  const demoteUserId = "a0000000-0000-4000-8000-000000000005";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const startsAt = new Date(Date.now() - 60_000).toISOString();
  const endsAt = new Date(Date.now() + 3_600_000).toISOString();

  const createSql = `select public.create_staff_assignment(
    $1, $2, $3, $4, $5::public.staff_job_label, $6, $7, $8
  ) as id`;

  const sameKey = "e0000000-0000-4000-8000-000000000001";
  const samePayload = [
    organizationId,
    ownerId,
    retryUserId,
    classId,
    "substitute",
    startsAt,
    endsAt,
    sameKey,
  ];
  const sameResults = await synchronizedPair(
    config,
    "same-create",
    (client) => client.query(createSql, samePayload),
    (client) => client.query(createSql, samePayload),
  );
  assert(sameResults.every((result) => result.status === "fulfilled"));
  const sameIds = sameResults.map((result) => result.value.rows[0].id);
  assert.equal(sameIds[0], sameIds[1]);

  await withClient(config, "klar-a1-assert-same", async (client) => {
    const result = await client.query(
      `select
         (select count(*)::integer from public.staff_assignments where id = $1) as assignments,
         (select count(*)::integer from public.staff_assignment_class_scopes where assignment_id = $1) as scopes,
         (select count(*)::integer from public.staff_assignment_capabilities where assignment_id = $1) as capabilities,
         (select count(*)::integer from public.audit_events where event_name = 'staff_assignment.created' and entity_id = $1) as audits`,
      [sameIds[0]],
    );
    assert.deepEqual(result.rows[0], { assignments: 1, scopes: 1, capabilities: 6, audits: 1 });
  });

  const conflictKey = "e0000000-0000-4000-8000-000000000002";
  const conflictResults = await synchronizedPair(
    config,
    "conflict-create",
    (client) =>
      client.query(createSql, [
        organizationId,
        ownerId,
        retryUserId,
        classId,
        "contact_teacher",
        startsAt,
        endsAt,
        conflictKey,
      ]),
    (client) =>
      client.query(createSql, [
        organizationId,
        ownerId,
        retryUserId,
        classId,
        "subject_teacher",
        startsAt,
        endsAt,
        conflictKey,
      ]),
  );
  assert.equal(conflictResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(conflictResults.filter((result) => result.status === "rejected").length, 1);

  const revokeAssignmentId = await withClient(config, "klar-a1-find-revoke", async (client) => {
    const result = await client.query(
      "select id from public.staff_assignments where user_id = $1 and revoked_at is null",
      [revokeUserId],
    );
    return result.rows[0].id;
  });
  const revokeSql =
    "select (public.revoke_staff_assignment($1,$2,$3)).revoked_at as revoked_at";
  const revokeResults = await synchronizedPair(
    config,
    "parallel-revoke",
    (client) => client.query(revokeSql, [organizationId, ownerId, revokeAssignmentId]),
    (client) => client.query(revokeSql, [organizationId, ownerId, revokeAssignmentId]),
  );
  assert(revokeResults.every((result) => result.status === "fulfilled"));
  assert.equal(
    new Date(revokeResults[0].value.rows[0].revoked_at).toISOString(),
    new Date(revokeResults[1].value.rows[0].revoked_at).toISOString(),
  );
  await withClient(config, "klar-a1-assert-revoke", async (client) => {
    const result = await client.query(
      "select count(*)::integer as count from public.audit_events where event_name = 'staff_assignment.revoked' and entity_id = $1",
      [revokeAssignmentId],
    );
    assert.equal(result.rows[0].count, 1);
  });

  const expiryAssignmentId = await withClient(config, "klar-a1-create-expiry", async (client) => {
    const result = await client.query(createSql, [
      organizationId,
      ownerId,
      retryUserId,
      classId,
      "substitute",
      new Date(Date.now() - 120_000).toISOString(),
      new Date(Date.now() - 60_000).toISOString(),
      "e0000000-0000-4000-8000-000000000003",
    ]);
    return result.rows[0].id;
  });
  const expiryResults = await synchronizedPair(
    config,
    "parallel-expiry",
    (client) => client.query("select public.reconcile_expired_staff_assignments($1) as count", [organizationId]),
    (client) => client.query("select public.reconcile_expired_staff_assignments($1) as count", [organizationId]),
  );
  assert(expiryResults.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    expiryResults.map((result) => result.value.rows[0].count).sort(),
    [0, 1],
  );
  await withClient(config, "klar-a1-assert-expiry", async (client) => {
    const result = await client.query(
      `select
         assignment.ends_at,
         assignment.expiry_audited_at,
         audit.actor_id,
         audit.authorizing_staff_assignment_id,
         audit.authorizing_capability,
         audit.metadata ->> 'effective_at' as effective_at,
         audit.metadata ->> 'recorded_at' as recorded_at
       from public.staff_assignments as assignment
       join public.audit_events as audit
         on audit.entity_id = assignment.id
        and audit.event_name = 'staff_assignment.expired'
       where assignment.id = $1`,
      [expiryAssignmentId],
    );
    assert.equal(result.rows.length, 1);
    const row = result.rows[0];
    assert.notEqual(row.expiry_audited_at, null);
    assert.equal(
      new Date(row.effective_at).toISOString(),
      new Date(row.ends_at).toISOString(),
    );
    assert.equal(
      new Date(row.recorded_at).toISOString(),
      new Date(row.expiry_audited_at).toISOString(),
    );
    assert.equal(row.actor_id, null);
    assert.equal(row.authorizing_staff_assignment_id, null);
    assert.equal(row.authorizing_capability, null);
  });

  const raceAssignmentId = await withClient(config, "klar-a1-find-race", async (client) => {
    const result = await client.query(
      "select id from public.staff_assignments where user_id = $1 and revoked_at is null",
      [raceUserId],
    );
    return result.rows[0].id;
  });
  const raceTitle = "Samtidig revoke og publisering";
  const raceResults = await synchronizedPair(
    config,
    "revoke-mutation",
    (client) => client.query(revokeSql, [organizationId, ownerId, raceAssignmentId]),
    (client) =>
      client.query(
        "select public.publish_task_to_class($1,$2,$3,$4) as id",
        [classId, raceUserId, raceAssignmentId, raceTitle],
      ),
  );
  assert.equal(raceResults[0].status, "fulfilled");
  const publishSucceeded = raceResults[1].status === "fulfilled";
  await withClient(config, "klar-a1-assert-race", async (client) => {
    const result = await client.query(
      `select
        (select count(*)::integer from public.task_definitions where title = $1) as tasks,
        (select count(*)::integer from public.audit_events where event_name = 'task.published' and metadata ->> 'class_id' = $2 and authorizing_staff_assignment_id = $3) as audits`,
      [raceTitle, classId, raceAssignmentId],
    );
    assert.equal(result.rows[0].tasks, publishSucceeded ? 1 : 0);
    assert.equal(result.rows[0].audits, publishSucceeded ? 1 : 0);
    await assert.rejects(
      client.query(
        "select public.publish_task_to_class($1,$2,$3,$4)",
        [classId, raceUserId, raceAssignmentId, "Stale grant skal avvises"],
      ),
    );
  });

  const demotionKey = "e0000000-0000-4000-8000-000000000004";
  const demotionResults = await synchronizedPair(
    config,
    "create-demotion",
    (client) =>
      client.query(createSql, [
        organizationId,
        ownerId,
        demoteUserId,
        classId,
        "substitute",
        startsAt,
        endsAt,
        demotionKey,
      ]),
    (client) =>
      client.query(
        "update public.memberships set role = 'student' where organization_id = $1 and user_id = $2 returning role",
        [organizationId, demoteUserId],
      ),
  );
  assert.equal(demotionResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(demotionResults.filter((result) => result.status === "rejected").length, 1);
  await withClient(config, "klar-a1-assert-demotion", async (client) => {
    const result = await client.query(
      `select membership.role::text as role,
        count(assignment.id) filter (
          where assignment.revoked_at is null
            and assignment.starts_at <= transaction_timestamp()
            and transaction_timestamp() < assignment.ends_at
        )::integer as active_assignments
       from public.memberships as membership
       left join public.staff_assignments as assignment
         on assignment.organization_id = membership.organization_id
         and assignment.user_id = membership.user_id
       where membership.organization_id = $1 and membership.user_id = $2
       group by membership.role`,
      [organizationId, demoteUserId],
    );
    assert.notDeepEqual(result.rows[0], { role: "student", active_assignments: 1 });
  });
}

async function runEmptyScenario() {
  const container = startContainer("empty");
  try {
    applyPreA1(container.name);
    runSql(container.name, `supabase/migrations/${a1Migration}`);
    applyA1Followups(container.name);
    runSql(container.name, "supabase/verification/rls_smoke.sql");
    runSql(container.name, "supabase/verification/staff_rls_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/staff_concurrency_fixture.sql");
    await runConcurrency(container.config);
    console.log("A1 database empty + RLS/RPC + concurrency: PASS");
  } finally {
    cleanupContainer(container.name);
  }
}

function runUpgradeScenario() {
  const positive = startContainer("upgrade-positive");
  try {
    applyPreA1(positive.name);
    runSql(positive.name, "supabase/verification/staff_upgrade_fixture.sql");
    runSql(positive.name, `supabase/migrations/${a1Migration}`);
    applyA1Followups(positive.name);
    runSql(positive.name, "supabase/verification/staff_upgrade_smoke.sql");
  } finally {
    cleanupContainer(positive.name);
  }

  const invalid = startContainer("upgrade-invalid");
  try {
    applyPreA1(invalid.name);
    runSql(invalid.name, "supabase/verification/staff_invalid_legacy_fixture.sql");
    const output = runSql(invalid.name, `supabase/migrations/${a1Migration}`, {
      expectFailure: true,
    });
    assert.match(
      output,
      /legacy teacher class membership has no current adult organization membership/i,
    );
    runSql(invalid.name, "supabase/verification/staff_invalid_legacy_assert.sql");
  } finally {
    cleanupContainer(invalid.name);
  }
  console.log("A1 database representative upgrade + atomic preflight: PASS");
}

try {
  const docker = spawnSync("docker", ["info"], {
    cwd: root,
    stdio: "ignore",
    shell: false,
    timeout: 15_000,
  });
  if (docker.error || docker.status !== 0) {
    throw new Error("Docker er ikke tilgjengelig. Ingen ekstern database ble berørt.");
  }
  if (scenario === "all" || scenario === "empty") await runEmptyScenario();
  if (scenario === "all" || scenario === "upgrade") runUpgradeScenario();
} finally {
  cleanupAll();
}
