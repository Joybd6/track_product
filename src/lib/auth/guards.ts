import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/auth/session";

export interface AuthUser extends SessionPayload {
  createdAt: string;
}

export async function requireUser(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    forcePasswordChange: user.forcePasswordChange,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
