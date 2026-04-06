import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "sc_session";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  forcePasswordChange: boolean;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, secretKey());
    const payload = verified.payload as JWTPayload;
    const userId = typeof payload.userId === "string" ? payload.userId : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    const role = payload.role === "ADMIN" || payload.role === "USER" ? payload.role : undefined;
    const forcePasswordChange = payload.forcePasswordChange === true;

    if (!userId || !email || !role) {
      return null;
    }

    return {
      ...payload,
      userId,
      email,
      role,
      forcePasswordChange,
    };
  } catch {
    return null;
  }
}
