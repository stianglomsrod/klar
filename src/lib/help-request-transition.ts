export type HelpRequestSnapshot = {
  id: string;
  taskAssignmentId: string | null;
} | null;

export type HelpRequestTransition = {
  changed: boolean;
  feedback: string | null;
};

export type HelpCommandIntent =
  | {
      kind: "request";
      taskAssignmentId: string | null;
    }
  | {
      kind: "cancel";
    };

export function getHelpRequestStateKey(
  request: HelpRequestSnapshot,
): string | null {
  return request
    ? `${request.id}:${request.taskAssignmentId ?? "general"}`
    : null;
}

export function getHelpRequestTransition(
  previousStateKey: string | null,
  nextRequest: HelpRequestSnapshot,
): HelpRequestTransition {
  if (previousStateKey === getHelpRequestStateKey(nextRequest)) {
    return { changed: false, feedback: null };
  }
  if (!nextRequest) {
    return { changed: true, feedback: "Du står ikke lenger i kø." };
  }
  return {
    changed: true,
    feedback: nextRequest.taskAssignmentId
      ? "Hjelpen er knyttet til oppgaven."
      : "Du står i kø.",
  };
}

export function isHelpCommandIntentSatisfied(
  intent: HelpCommandIntent,
  nextRequest: HelpRequestSnapshot,
): boolean {
  if (intent.kind === "cancel") return nextRequest === null;
  if (!nextRequest) return false;
  return (
    intent.taskAssignmentId === null ||
    nextRequest.taskAssignmentId === intent.taskAssignmentId
  );
}
