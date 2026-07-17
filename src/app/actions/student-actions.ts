"use server";

type CreateStudentInput = {
  fullName: string;
  className: string;
  gradeName: string;
};

type DisabledResult = { success: false; error: string };
type CreateStudentResult =
  | { success: true; username: string; password: string; fullName: string }
  | DisabledResult;
type ResetPasswordResult =
  | { success: true; newPassword: string }
  | DisabledResult;
type MutationResult = { success: true } | DisabledResult;
type CreateClassResult =
  | { success: true; id: string; name: string; grade_name: string }
  | DisabledResult;

function disabled(): DisabledResult {
  return { success: false, error: "Klar 2.x er arkivert i 3.0-branchen." };
}

/** @deprecated The 2.x administration model is intentionally unavailable in 3.0. */
export async function createStudent(
  input: CreateStudentInput,
): Promise<CreateStudentResult> {
  void input;
  return disabled();
}

/** @deprecated Use the authorized v3 student provisioning action. */
export async function resetStudentPassword(
  studentId: string,
): Promise<ResetPasswordResult> {
  void studentId;
  return disabled();
}

/** @deprecated Use the v3 class membership model. */
export async function updateStudentClass(
  studentId: string,
  className: string | null,
  gradeName: string | null,
): Promise<MutationResult> {
  void studentId;
  void className;
  void gradeName;
  return disabled();
}

/** @deprecated Use createTeacherClass through the v3 action. */
export async function createClass(
  className: string,
  gradeName?: string,
): Promise<CreateClassResult> {
  void className;
  void gradeName;
  return disabled();
}

export async function renameClass(
  classId: string,
  newName: string,
): Promise<MutationResult> {
  void classId;
  void newName;
  return disabled();
}

export async function renameGrade(
  gradeId: string,
  newName: string,
): Promise<MutationResult> {
  void gradeId;
  void newName;
  return disabled();
}

export async function deleteClass(classId: string): Promise<MutationResult> {
  void classId;
  return disabled();
}
