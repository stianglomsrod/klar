export type StudentSupportSettingRow = {
  student_id: string;
  support_level: number;
  progress_enabled: boolean;
};

export type StudentSupportBoundaryResult = {
  available: boolean;
  rows: StudentSupportSettingRow[];
};

type StudentSupportBoundaryInput = {
  organizationId: string;
  studentIds: string[];
  authorize: () => Promise<boolean>;
  select: (scope: {
    organizationId: string;
    studentIds: string[];
  }) => Promise<StudentSupportSettingRow[]>;
};

export async function readStudentSupportSettingsAtBoundary({
  organizationId,
  studentIds,
  authorize,
  select,
}: StudentSupportBoundaryInput): Promise<StudentSupportBoundaryResult> {
  if (!(await authorize())) return { available: false, rows: [] };
  if (studentIds.length === 0) return { available: true, rows: [] };

  const rows = await select({
    organizationId,
    studentIds: [...studentIds],
  });

  if (!(await authorize())) return { available: false, rows: [] };
  return { available: true, rows };
}

export function resolveStudentSupportSetting(
  rowsByStudent: Map<string, StudentSupportSettingRow>,
  studentId: string,
): { supportLevel: number; progressEnabled: boolean } {
  const row = rowsByStudent.get(studentId);
  return {
    supportLevel: row?.support_level ?? 2,
    progressEnabled: row?.progress_enabled ?? false,
  };
}
