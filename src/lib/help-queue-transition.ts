export function getHelpQueueTransitionAt(
  nextTransitionAt: string | null,
  currentSessionEndsAt: string | null,
): string | null {
  return nextTransitionAt ?? currentSessionEndsAt;
}
