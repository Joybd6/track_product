import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createRegistrationInvite, listRegistrationInvites } from "@/lib/settings/admin-settings";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const invites = await listRegistrationInvites();
    return NextResponse.json({ invites });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = (await request.json()) as { label?: string; expiresInDays?: number };

    const expiresInDays = Number(body.expiresInDays ?? 0);
    const expiresAt =
      Number.isFinite(expiresInDays) && expiresInDays > 0
        ? new Date(Date.now() + Math.floor(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    const invite = await createRegistrationInvite({
      label: body.label,
      expiresAt,
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create invite" }, { status: 400 });
  }
}
