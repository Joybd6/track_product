import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const count = await db.user.count();
  return NextResponse.json({
    isFirstRun: count === 0,
  });
}
