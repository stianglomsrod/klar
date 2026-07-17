const RECIPIENT_PREVIEW_LIMIT = 3;

export function formatRecipientPreview(names: readonly string[]): string {
  const visibleNames = names.slice(0, RECIPIENT_PREVIEW_LIMIT);
  const remainingCount = names.length - visibleNames.length;
  return remainingCount > 0
    ? `${visibleNames.join(", ")} og ${remainingCount} til`
    : visibleNames.join(", ");
}
