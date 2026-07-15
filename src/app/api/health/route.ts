import { NextResponse } from "next/server";
import {
  getPublicSupabaseEnvironment,
  isPilotEnabled,
} from "@/lib/env/public";

export const dynamic = "force-dynamic";

export function GET() {
  let configured = true;
  try {
    getPublicSupabaseEnvironment();
  } catch {
    configured = false;
  }

  const pilotEnabled = isPilotEnabled();
  const ready = configured && pilotEnabled;
  return NextResponse.json(
    {
      status: ready ? "ok" : "unavailable",
      pilotEnabled,
      configured,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
