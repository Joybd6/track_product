import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/guards";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "currentPassword and newPassword (min 8 chars) are required" },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { id: user.userId } });
    if (!existing) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const valid = await verifyPassword(currentPassword, existing.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        forcePasswordChange: false,
      },
    });

    const token = await createSessionToken({
      userId: updated.id,
      email: updated.email,
      role: updated.role,
      forcePasswordChange: false,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
