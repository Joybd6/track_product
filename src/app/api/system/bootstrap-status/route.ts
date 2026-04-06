import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRegistrationEnabled, getRegistrationMode } from "@/lib/settings/admin-settings";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const count = await db.user.count();
  const registrationMode = await getRegistrationMode();
  const registrationEnabled = await getRegistrationEnabled();
  return NextResponse.json({
    isFirstRun: count === 0,
    registrationEnabled,
    registrationMode,
  });
}
