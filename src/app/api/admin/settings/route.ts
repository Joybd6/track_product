import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getRegistrationEnabled,
  getSmtpConfig,
  saveRegistrationEnabled,
  saveSmtpConfig,
} from "@/lib/settings/admin-settings";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const smtp = await getSmtpConfig();
    const registrationEnabled = await getRegistrationEnabled();
    return NextResponse.json({ smtp, registrationEnabled });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      host?: string;
      port?: number;
      user?: string;
      pass?: string;
      fromEmail?: string;
      secure?: boolean;
      registrationEnabled?: boolean;
    };

    let smtp = await getSmtpConfig();
    if (body.host || body.port || body.fromEmail || body.user || body.pass || typeof body.secure === "boolean") {
      if (!body.host || !body.port || !body.fromEmail) {
        return NextResponse.json(
          { error: "host, port, fromEmail are required" },
          { status: 400 },
        );
      }

      smtp = await saveSmtpConfig({
        host: body.host,
        port: Number(body.port),
        user: body.user,
        pass: body.pass,
        fromEmail: body.fromEmail,
        secure: body.secure,
      });
    }

    let registrationEnabled = await getRegistrationEnabled();
    if (typeof body.registrationEnabled === "boolean") {
      registrationEnabled = await saveRegistrationEnabled(body.registrationEnabled);
    }

    return NextResponse.json({ smtp, registrationEnabled });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
