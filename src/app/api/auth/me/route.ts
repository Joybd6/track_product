import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
