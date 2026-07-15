import "server-only";

import { getPublicSupabaseEnvironment } from "./public";

function requireServerValue(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Mangler servervariabelen ${name}. Se .env.example for nodvendig konfigurasjon.`,
    );
  }

  return value;
}

export function getSupabaseAdminEnvironment() {
  return {
    ...getPublicSupabaseEnvironment(),
    serviceRoleKey: requireServerValue(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}

export function getStudentCodePepper(): string {
  const pepper = requireServerValue(
    "STUDENT_CODE_PEPPER",
    process.env.STUDENT_CODE_PEPPER,
  );

  if (pepper.length < 32) {
    throw new Error("STUDENT_CODE_PEPPER må være minst 32 tegn.");
  }

  return pepper;
}
