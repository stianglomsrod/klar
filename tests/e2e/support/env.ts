function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} mangler for autentisert E2E.`);
  return value;
}
export function getE2ECredentials() {
  return {
    ownerEmail: required("KLAR_E2E_OWNER_EMAIL"),
    ownerPassword: required("KLAR_E2E_OWNER_PASSWORD"),
    studentCode: required("KLAR_E2E_STUDENT_CODE"),
    studentPassword: required("KLAR_E2E_STUDENT_PASSWORD"),
  };
}
