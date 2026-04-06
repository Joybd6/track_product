import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const count = await db.user.count();
  if (count > 0) {
    return NextResponse.json({ error: "Installation already completed" }, { status: 409 });
  }

  const email = process.env.INIT_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INIT_ADMIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: "INIT_ADMIN_EMAIL and INIT_ADMIN_PASSWORD are required" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "INIT_ADMIN_PASSWORD must be at least 8 characters" },
      { status: 400 },
    );
  }

  await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      forcePasswordChange: true,
    },
  });

  return NextResponse.json({
    ok: true,
    adminEmail: email,
  });
}
