import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getRegistrationEnabled,
  getRegistrationMode,
  getSmtpConfig,
  type RegistrationMode,
  saveRegistrationMode,
  saveSmtpConfig,
} from "@/lib/settings/admin-settings";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const smtp = await getSmtpConfig();
    const registrationMode = await getRegistrationMode();
    const registrationEnabled = await getRegistrationEnabled();
    return NextResponse.json({ smtp, registrationEnabled, registrationMode });
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
      registrationMode?: RegistrationMode;
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

    let registrationMode = await getRegistrationMode();
    if (typeof body.registrationMode === "string") {
      if (!["open", "disabled", "invite_only"].includes(body.registrationMode)) {
        return NextResponse.json({ error: "registrationMode is invalid" }, { status: 400 });
      }
      registrationMode = await saveRegistrationMode(body.registrationMode);
    } else if (typeof body.registrationEnabled === "boolean") {
      registrationMode = await saveRegistrationMode(body.registrationEnabled ? "open" : "disabled");
    }

    const registrationEnabled = registrationMode === "open";

    return NextResponse.json({ smtp, registrationEnabled, registrationMode });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
