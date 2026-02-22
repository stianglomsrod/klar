"use server";

import { createClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────
type CreateStudentInput = {
  fullName: string;
  className: string; // e.g. "5A"
  gradeName: string; // e.g. "5. Trinn"
};

type CreateStudentResult =
  | {
      success: true;
      username: string;
      password: string;
      fullName: string;
    }
  | {
      success: false;
      error: string;
    };

type ResetPasswordResult =
  | { success: true; newPassword: string }
  | { success: false; error: string };

type UpdateClassResult = { success: true } | { success: false; error: string };

// ── Helpers ──────────────────────────────────────────

/** "Ole Oppfinner" → "ole.oppfinner" */
function toUsername(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-zæøå0-9.]/g, "");
}

/** Dicebear avataaars URL (same pattern as seed route) */
function getAvatarUrl(name: string): string {
  const seed = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

// ── Server Action ────────────────────────────────────

export async function createStudent(
  input: CreateStudentInput,
): Promise<CreateStudentResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  // Admin client — bypasses RLS, can call auth.admin.*
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = "1234";

  try {
    // 1. Generate unique username + email
    let baseUsername = toUsername(input.fullName);
    if (!baseUsername) baseUsername = "elev";

    let username = baseUsername;
    let email = `${username}@skole.klar.app`;
    let attempts = 0;

    // Check for collisions by attempting creation — retry with suffix on conflict
    while (attempts < 20) {
      // Try creating — if email collision, Supabase returns an error and we retry
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: input.fullName },
        });

      if (authError) {
        if (
          authError.message.includes("already been registered") ||
          authError.message.includes("already exists")
        ) {
          attempts++;
          username = `${baseUsername}${attempts}`;
          email = `${username}@skole.klar.app`;
          continue;
        }
        return {
          success: false,
          error: `Feil ved opprettelse av bruker: ${authError.message}`,
        };
      }

      const userId = authData.user.id;

      // 2. Insert into profiles
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: input.fullName,
        role: "student",
        avatar_url: getAvatarUrl(input.fullName),
      });

      if (profileError) {
        // Cleanup: delete auth user on failure
        await supabase.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: `Feil ved opprettelse av profil: ${profileError.message}`,
        };
      }

      // 3. Insert into student_profiles (so the RPC UPDATE works)
      const { error: spError } = await supabase
        .from("student_profiles")
        .upsert({
          id: userId,
          level: 1,
          points_earned: 0,
          current_goal_total: 1000,
          current_xp: 0,
          flowers_collected: 0,
          petals_progress: 0,
          petal_colors: ["#E0E0E0", "#E0E0E0", "#E0E0E0", "#E0E0E0", "#E0E0E0"],
          show_flower_garden: true,
          max_level_reached: 1,
          current_password_plaintext: password,
        });

      if (spError) {
        await supabase.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: `Feil ved opprettelse av elevprofil: ${spError.message}`,
        };
      }

      // 4. Link student to class structure (creates grade/class if needed)
      const { error: rpcError } = await supabase.rpc(
        "link_student_to_class_structure",
        {
          p_student_id: userId,
          p_class_name: input.className,
          p_grade_name: input.gradeName,
        },
      );

      if (rpcError) {
        // Non-fatal — student exists but class link failed
        console.error(
          "RPC link_student_to_class_structure failed:",
          rpcError.message,
        );
        // Don't delete user, just warn
      }

      return {
        success: true,
        username,
        password,
        fullName: input.fullName,
      };
    }

    return {
      success: false,
      error: "Kunne ikke generere unikt brukernavn etter mange forsøk.",
    };
  } catch (err) {
    console.error("createStudent unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Kid-friendly password generator ──────────────────

const COLORS = [
  "Rød",
  "Blå",
  "Grønn",
  "Gul",
  "Rosa",
  "Lilla",
  "Hvit",
  "Oransje",
];
const ANIMALS = [
  "Katt",
  "Hund",
  "Rev",
  "Bjørn",
  "Ugle",
  "Hest",
  "Fisk",
  "Mus",
  "Elg",
  "Hare",
  "Ulv",
  "Ørn",
];

function generateKidPassword(): string {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const digits = Math.floor(Math.random() * 90 + 10); // 10-99
  return `${color}${animal}${digits}`;
}

// ── Admin client helper ──────────────────────────────

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Reset student password ───────────────────────────

export async function resetStudentPassword(
  studentId: string,
): Promise<ResetPasswordResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  const newPassword = generateKidPassword();

  try {
    // 1. Update password in auth.users via admin API
    const { error: authError } = await supabase.auth.admin.updateUserById(
      studentId,
      { password: newPassword },
    );

    if (authError) {
      return {
        success: false,
        error: `Kunne ikke oppdatere passord: ${authError.message}`,
      };
    }

    // 2. Store plaintext copy in student_profiles
    const { error: profileError } = await supabase
      .from("student_profiles")
      .update({ current_password_plaintext: newPassword })
      .eq("id", studentId);

    if (profileError) {
      console.error(
        "Failed to update plaintext password column:",
        profileError.message,
      );
      // Non-fatal — auth password IS updated, plaintext column just didn't sync
    }

    return { success: true, newPassword };
  } catch (err) {
    console.error("resetStudentPassword unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Update student class ─────────────────────────────

export async function updateStudentClass(
  studentId: string,
  className: string,
  gradeName: string,
): Promise<UpdateClassResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  try {
    const { error: rpcError } = await supabase.rpc(
      "link_student_to_class_structure",
      {
        p_student_id: studentId,
        p_class_name: className,
        p_grade_name: gradeName,
      },
    );

    if (rpcError) {
      return {
        success: false,
        error: `Kunne ikke oppdatere klasse: ${rpcError.message}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("updateStudentClass unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
