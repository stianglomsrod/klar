/**
 * Determine whether an avatar value is an image URL (render as <img>)
 * or an emoji string (render as text).
 *
 * In Klar, student avatars are stored as emoji strings ("🐶") in
 * profiles.avatar_url via AvatarPickerModal.  Teacher avatars may
 * be actual URLs.  A bare truthiness check like `avatar_url ? <img> : fallback`
 * produces a broken image when the value is an emoji.
 */
export function isImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:")
  );
}
