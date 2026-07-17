export type HelpQueueReplicationState = "ready" | "error" | "other";

const REPLICATION_READY_EXTENSIONS = new Set([
  "system",
  "postgres_changes",
]);

export function getHelpQueueReplicationState(
  extension: string | undefined,
  status: string | undefined,
): HelpQueueReplicationState {
  if (!extension || !REPLICATION_READY_EXTENSIONS.has(extension)) {
    return "other";
  }
  if (status === "ok") return "ready";
  if (status === "error") return "error";
  return "other";
}
