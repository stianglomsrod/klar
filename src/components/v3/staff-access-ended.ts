export function redirectIfStaffAccessEnded(
  result: { success: boolean; accessEnded?: true },
  classId: string,
): boolean {
  if (result.success || !result.accessEnded) return false;
  window.location.assign(`/v3/teacher/classes/${classId}?access=ended`);
  return true;
}
