import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "sc_session";

async function verifySession(
  token: string,
): Promise<{ valid: boolean; forcePasswordChange: boolean }> {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return { valid: false, forcePasswordChange: false };
    }

    const verified = await jwtVerify(token, new TextEncoder().encode(secret));
    return {
      valid: true,
      forcePasswordChange: verified.payload.forcePasswordChange === true,
    };
  } catch {
    return { valid: false, forcePasswordChange: false };
  }
}

async function getBootstrapState(request: NextRequest): Promise<{ isFirstRun: boolean }> {
  const url = request.nextUrl.clone();
  url.pathname = "/api/system/bootstrap-status";
  url.search = "";

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "x-sc-bootstrap-check": "1",
      },
    });

    if (!response.ok) {
      return { isFirstRun: false };
    }

    const payload = (await response.json()) as { isFirstRun?: boolean };
    return { isFirstRun: payload.isFirstRun === true };
  } catch {
    return { isFirstRun: false };
  }
}

async function getAuthState(request: NextRequest): Promise<{ authenticated: boolean }> {
  const url = request.nextUrl.clone();
  url.pathname = "/api/auth/me";
  url.search = "";

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });

    return { authenticated: response.ok };
  } catch {
    return { authenticated: false };
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/system/bootstrap-status")) {
    return NextResponse.next();
  }

  const bootstrap = await getBootstrapState(request);

  if (bootstrap.isFirstRun) {
    if (pathname.startsWith("/install") || pathname.startsWith("/api/install/bootstrap")) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Installation required" }, { status: 503 });
    }

    const installUrl = request.nextUrl.clone();
    installUrl.pathname = "/install";
    return NextResponse.redirect(installUrl);
  }

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/embed")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  const session = await verifySession(token);
  if (!session.valid) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith("/api")) {
    const authState = await getAuthState(request);
    if (!authState.authenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      return NextResponse.redirect(url);
    }
  }

  if (session.forcePasswordChange) {
    const canProceed =
      pathname.startsWith("/auth/change-password") ||
      pathname.startsWith("/api/auth/change-password") ||
      pathname.startsWith("/api/auth/logout") ||
      pathname.startsWith("/api/auth/me");

    if (!canProceed) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          { error: "Password change required before continuing" },
          { status: 403 },
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/auth/change-password";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
