import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { consumeRegistrationInvite, getRegistrationMode } from "@/lib/settings/admin-settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { email?: string; password?: string; inviteCode?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const inviteCode = body.inviteCode?.trim() ?? "";

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (min 8 chars) are required" },
        { status: 400 },
      );
    }

    const userCount = await db.user.count();
    const registrationMode = await getRegistrationMode();
    if (userCount > 0 && registrationMode !== "open") {
      if (registrationMode === "disabled") {
        return NextResponse.json({ error: "New registration is disabled by admin" }, { status: 403 });
      }

      if (!inviteCode) {
        return NextResponse.json({ error: "Invite code is required" }, { status: 403 });
      }
      const consumed = await consumeRegistrationInvite(inviteCode, email);
      if (!consumed.ok) {
        return NextResponse.json({ error: consumed.reason }, { status: 403 });
      }
    } else if (userCount > 0 && registrationMode === "open" && inviteCode) {
      const consumed = await consumeRegistrationInvite(inviteCode, email);
      if (!consumed.ok) {
        return NextResponse.json({ error: consumed.reason }, { status: 403 });
      }
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: userCount === 0 ? "ADMIN" : "USER",
        forcePasswordChange: false,
      },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
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

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        forcePasswordChange: false,
      },
    });
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
