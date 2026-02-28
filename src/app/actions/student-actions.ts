"use server";

import { createClient } from "@supabase/supabase-js";
import { normalizeClassName } from "./shared-normalization";
import { DEFAULT_PETAL_COLORS } from "@/utils/constants";

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

type CreateClassResult =
  | { success: true; id: string; name: string; grade_name: string }
  | { success: false; error: string };

type MutationResult = { success: true } | { success: false; error: string };

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
          petal_colors: [...DEFAULT_PETAL_COLORS],
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
      const normalizedClass = normalizeClassName(input.className);
      const { error: rpcError } = await supabase.rpc(
        "link_student_to_class_structure",
        {
          p_student_id: userId,
          p_class_name: normalizedClass,
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
  className: string | null,
  gradeName: string | null,
): Promise<UpdateClassResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  try {
    // null className = remove student from class
    if (!className) {
      const { error } = await supabase
        .from("student_profiles")
        .update({ class_id: null })
        .eq("id", studentId);

      if (error) {
        return {
          success: false,
          error: `Kunne ikke fjerne klasse: ${error.message}`,
        };
      }
      return { success: true };
    }

    const normalizedClass = normalizeClassName(className);
    const { error: rpcError } = await supabase.rpc(
      "link_student_to_class_structure",
      {
        p_student_id: studentId,
        p_class_name: normalizedClass,
        p_grade_name: gradeName || "Annet",
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

// ── Create class (standalone, no student) ────────────

/** "5A" → "5. Trinn", "10B" → "10. Trinn", "Piano" → "Annet" */
function inferGradeName(className: string): string {
  const match = className.match(/^(\d+)/);
  return match ? `${match[1]}. Trinn` : "Annet";
}

export async function createClass(
  className: string,
  gradeName?: string,
): Promise<CreateClassResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  try {
    const normalizedClass = normalizeClassName(className);
    if (!normalizedClass) {
      return { success: false, error: "Klassenavn kan ikke være tomt." };
    }

    const resolvedGrade = gradeName || inferGradeName(normalizedClass);

    // 1. Upsert grade (case-insensitive lookup)
    let gradeId: string;
    const { data: existingGrade } = await supabase
      .from("grades")
      .select("id")
      .ilike("name", resolvedGrade)
      .limit(1)
      .single();

    if (existingGrade) {
      gradeId = existingGrade.id;
    } else {
      const { data: newGrade, error: gradeError } = await supabase
        .from("grades")
        .insert({ name: resolvedGrade })
        .select("id")
        .single();
      if (gradeError || !newGrade) {
        return {
          success: false,
          error: `Kunne ikke opprette trinn: ${gradeError?.message ?? "ukjent feil"}`,
        };
      }
      gradeId = newGrade.id;
    }

    // 2. Check if class already exists (case-insensitive + same grade)
    const { data: existingClass } = await supabase
      .from("classes")
      .select("id, name")
      .ilike("name", normalizedClass)
      .eq("grade_id", gradeId)
      .limit(1)
      .single();

    if (existingClass) {
      return {
        success: false,
        error: `Klassen "${existingClass.name}" finnes allerede.`,
      };
    }

    // 3. Insert class
    const { data: newClass, error: classError } = await supabase
      .from("classes")
      .insert({
        name: normalizedClass,
        grade_id: gradeId,
        is_queue_open: false,
      })
      .select("id, name")
      .single();

    if (classError || !newClass) {
      return {
        success: false,
        error: `Kunne ikke opprette klasse: ${classError?.message ?? "ukjent feil"}`,
      };
    }

    return {
      success: true,
      id: newClass.id,
      name: newClass.name,
      grade_name: resolvedGrade,
    };
  } catch (err) {
    console.error("createClass unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Rename class ─────────────────────────────────────

export async function renameClass(
  classId: string,
  newName: string,
): Promise<MutationResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  const normalized = normalizeClassName(newName);
  if (!normalized) {
    return { success: false, error: "Klassenavn kan ikke være tomt." };
  }

  try {
    // Fetch existing class to get its grade_id
    const { data: existing, error: fetchErr } = await supabase
      .from("classes")
      .select("grade_id")
      .eq("id", classId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: "Klassen ble ikke funnet." };
    }

    // Check for duplicate within same grade
    const { data: duplicate } = await supabase
      .from("classes")
      .select("id")
      .ilike("name", normalized)
      .eq("grade_id", existing.grade_id)
      .neq("id", classId)
      .limit(1)
      .single();

    if (duplicate) {
      return {
        success: false,
        error: `Klassen "${normalized}" finnes allerede i dette trinnet.`,
      };
    }

    // Potentially update grade_id if the new name implies a different grade
    const newGradeName = inferGradeName(normalized);
    let newGradeId = existing.grade_id;

    // Check if the grade changed
    const { data: currentGrade } = await supabase
      .from("grades")
      .select("name")
      .eq("id", existing.grade_id)
      .single();

    if (!currentGrade || currentGrade.name !== newGradeName) {
      // Upsert the new grade
      const { data: existingGrade } = await supabase
        .from("grades")
        .select("id")
        .ilike("name", newGradeName)
        .limit(1)
        .single();

      if (existingGrade) {
        newGradeId = existingGrade.id;
      } else {
        const { data: newGrade, error: gradeErr } = await supabase
          .from("grades")
          .insert({ name: newGradeName })
          .select("id")
          .single();
        if (gradeErr || !newGrade) {
          return {
            success: false,
            error: `Kunne ikke opprette trinn: ${gradeErr?.message ?? "ukjent feil"}`,
          };
        }
        newGradeId = newGrade.id;
      }
    }

    const { error: updateErr } = await supabase
      .from("classes")
      .update({ name: normalized, grade_id: newGradeId })
      .eq("id", classId);

    if (updateErr) {
      return {
        success: false,
        error: `Kunne ikke endre navn: ${updateErr.message}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("renameClass unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Rename grade ─────────────────────────────────────

export async function renameGrade(
  gradeId: string,
  newName: string,
): Promise<MutationResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  const trimmed = newName.trim();
  if (!trimmed) {
    return { success: false, error: "Trinnnavn kan ikke være tomt." };
  }

  try {
    // Check for duplicate grade name
    const { data: duplicate } = await supabase
      .from("grades")
      .select("id")
      .ilike("name", trimmed)
      .neq("id", gradeId)
      .limit(1)
      .single();

    if (duplicate) {
      return { success: false, error: `Trinnet "${trimmed}" finnes allerede.` };
    }

    const { error: updateErr } = await supabase
      .from("grades")
      .update({ name: trimmed })
      .eq("id", gradeId);

    if (updateErr) {
      return {
        success: false,
        error: `Kunne ikke endre trinn: ${updateErr.message}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("renameGrade unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Delete class (only if empty) ─────────────────────

export async function deleteClass(classId: string): Promise<MutationResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Mangler serverkonfigurasjon (env-variabler).",
    };
  }

  try {
    // Check if any students are assigned to this class
    const { count, error: countErr } = await supabase
      .from("student_profiles")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId);

    if (countErr) {
      return {
        success: false,
        error: `Kunne ikke sjekke elever: ${countErr.message}`,
      };
    }

    if (count && count > 0) {
      return {
        success: false,
        error: `Kan ikke slette klassen — den har fortsatt ${count} elev${count !== 1 ? "er" : ""}.`,
      };
    }

    const { error: deleteErr } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId);

    if (deleteErr) {
      return {
        success: false,
        error: `Kunne ikke slette klasse: ${deleteErr.message}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("deleteClass unexpected error:", err);
    return {
      success: false,
      error: `Uventet feil: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
