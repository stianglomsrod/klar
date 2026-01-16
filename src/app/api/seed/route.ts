import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Seed data structure
const SEED_DATA = {
  password: "1234",
  grades: [
    {
      name: "5. Trinn",
      classes: [
        {
          name: "5A",
          students: [
            { name: "Ole Oppfinner", email: "ole@skole.no" },
            { name: "Kari Kreativ", email: "kari@skole.no" },
            { name: "Per Påskehare", email: "per@skole.no" },
          ],
        },
        {
          name: "5B",
          students: [{ name: "Lise Lesehest", email: "lise@skole.no" }],
        },
      ],
    },
    {
      name: "10. Trinn",
      classes: [
        {
          name: "10A",
          students: [{ name: "Rånny Råner", email: "ranny@skole.no" }],
        },
      ],
    },
  ],
};

// Generate Dicebear avatar URL
function getAvatarUrl(name: string): string {
  const seed = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

export async function POST() {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Missing environment variables",
        details:
          "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
      },
      { status: 500 }
    );
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const results: {
    created: { name: string; email: string; grade: string; class: string }[];
    skipped: { email: string; reason: string }[];
    errors: { email: string; error: string }[];
  } = {
    created: [],
    skipped: [],
    errors: [],
  };

  // Process each grade -> class -> student
  for (const grade of SEED_DATA.grades) {
    for (const cls of grade.classes) {
      for (const student of cls.students) {
        try {
          // Check if user already exists
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(
            (u) => u.email === student.email
          );

          let userId: string;

          if (existingUser) {
            // Option 1: Skip existing user
            // results.skipped.push({ email: student.email, reason: "User already exists" });
            // continue;

            // Option 2: Delete and recreate (for fresh seed)
            console.log(`Deleting existing user: ${student.email}`);
            await supabase.auth.admin.deleteUser(existingUser.id);
          }

          // Create Auth User
          const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
              email: student.email,
              password: SEED_DATA.password,
              email_confirm: true,
              user_metadata: {
                full_name: student.name,
              },
            });

          if (authError) {
            results.errors.push({
              email: student.email,
              error: `Auth creation failed: ${authError.message}`,
            });
            continue;
          }

          userId = authData.user.id;

          // Create Profile
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: userId,
              full_name: student.name,
              role: "student",
              avatar_url: getAvatarUrl(student.name),
            });

          if (profileError) {
            results.errors.push({
              email: student.email,
              error: `Profile creation failed: ${profileError.message}`,
            });
            continue;
          }

          // Call RPC to link student to class structure
          // This creates Grade and Class if they don't exist
          const { error: rpcError } = await supabase.rpc(
            "link_student_to_class_structure",
            {
              p_student_id: userId,
              p_class_name: cls.name,
              p_grade_name: grade.name,
            }
          );

          if (rpcError) {
            results.errors.push({
              email: student.email,
              error: `RPC link failed: ${rpcError.message}`,
            });
            continue;
          }

          results.created.push({
            name: student.name,
            email: student.email,
            grade: grade.name,
            class: cls.name,
          });

          console.log(
            `✅ Created: ${student.name} (${student.email}) -> ${grade.name} / ${cls.name}`
          );
        } catch (err) {
          results.errors.push({
            email: student.email,
            error: `Unexpected error: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      created: results.created.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    },
    results,
    credentials: {
      password: SEED_DATA.password,
      note: "All students use the same password",
    },
  });
}

// Also support GET for easy browser testing (shows instructions)
export async function GET() {
  return NextResponse.json({
    message: "Database Seed Endpoint",
    usage: "Send a POST request to this endpoint to seed the database",
    willCreate: {
      grades: SEED_DATA.grades.map((g) => ({
        name: g.name,
        classes: g.classes.map((c) => ({
          name: c.name,
          students: c.students.map((s) => s.email),
        })),
      })),
    },
    password: SEED_DATA.password,
    curlExample: "curl -X POST http://localhost:3000/api/seed",
  });
}
