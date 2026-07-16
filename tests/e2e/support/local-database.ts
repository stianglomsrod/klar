import { Client } from "pg";
import { assertLocalDatabaseUrl } from "../../../scripts/e2e/local-safety.mjs";

export const STAFF_CAPABILITIES = [
  "class.workspace.read",
  "task.publish",
  "plan.preview",
  "plan.publish",
  "help_queue.manage",
  "student_support.update",
] as const;

export async function openLocalDatabase(): Promise<Client> {
  const connectionString = assertLocalDatabaseUrl(
    process.env.KLAR_E2E_DB_URL ?? "",
  );
  const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
  await client.connect();
  return client;
}

export async function restoreCapabilityProfile(
  client: Client,
  assignmentId: string,
): Promise<void> {
  await client.query(
    `
      insert into public.staff_assignment_capabilities (
        assignment_id,
        capability,
        profile_version
      )
      select
        $1::uuid,
        capability,
        'class_pedagogy_v1'
      from unnest(array[
        'class.workspace.read',
        'task.publish',
        'plan.preview',
        'plan.publish',
        'help_queue.manage',
        'student_support.update'
      ]::public.staff_capability[]) as capability
      on conflict (assignment_id, capability) do nothing
    `,
    [assignmentId],
  );
}

export async function retainOnlyCapabilities(
  client: Client,
  assignmentId: string,
  capabilities: readonly [string, ...string[]],
): Promise<void> {
  await client.query("begin");
  try {
    // Test-only fault injection. The guard above only permits loopback:54322,
    // and SET LOCAL restores normal trigger behavior when this transaction ends.
    await client.query("set local session_replication_role = replica");
    await client.query(
      `
        delete from public.staff_assignment_capabilities
        where assignment_id = $1::uuid
          and capability <> all($2::public.staff_capability[])
      `,
      [assignmentId, capabilities],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
