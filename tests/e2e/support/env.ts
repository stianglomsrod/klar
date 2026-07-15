function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} mangler for autentisert E2E.`);
  return value;
}
export function getE2ECredentials() {
  return {
    ownerEmail: required("KLAR_E2E_OWNER_EMAIL"),
    ownerPassword: required("KLAR_E2E_OWNER_PASSWORD"),
    substituteEmail: required("KLAR_E2E_SUBSTITUTE_EMAIL"),
    substitutePassword: required("KLAR_E2E_SUBSTITUTE_PASSWORD"),
    visualStaffEmail: required("KLAR_E2E_VISUAL_STAFF_EMAIL"),
    visualStaffPassword: required("KLAR_E2E_VISUAL_STAFF_PASSWORD"),
    visualOwnerEmail: required("KLAR_E2E_VISUAL_OWNER_EMAIL"),
    visualOwnerPassword: required("KLAR_E2E_VISUAL_OWNER_PASSWORD"),
    otherStaffEmail: required("KLAR_E2E_OTHER_STAFF_EMAIL"),
    otherStaffPassword: required("KLAR_E2E_OTHER_STAFF_PASSWORD"),
    studentCode: required("KLAR_E2E_STUDENT_CODE"),
    studentPassword: required("KLAR_E2E_STUDENT_PASSWORD"),
    visualStudentCode: required("KLAR_E2E_VISUAL_STUDENT_CODE"),
    visualStudentPassword: required("KLAR_E2E_VISUAL_STUDENT_PASSWORD"),
  };
}
