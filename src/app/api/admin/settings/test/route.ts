import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getSmtpConfig, type SmtpConfig } from "@/lib/settings/admin-settings";
import { sendSmtpMail } from "@/lib/email/smtp";

export const runtime = "nodejs";

interface TestEmailRequest {
  toEmail?: string;
  config?: Partial<SmtpConfig>;
}

function normalizeConfig(config?: Partial<SmtpConfig> | null): Partial<SmtpConfig> {
  return {
    host: config?.host?.trim(),
    port: typeof config?.port === "number" ? Number(config.port) : undefined,
    user: config?.user?.trim() || undefined,
    pass: config?.pass || undefined,
    fromEmail: config?.fromEmail?.trim(),
    secure: config?.secure === true,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as TestEmailRequest;

    const savedConfig = normalizeConfig(await getSmtpConfig());
    const bodyConfig = normalizeConfig(body.config);

    const merged: Partial<SmtpConfig> = {
      host: bodyConfig.host ?? savedConfig.host,
      port: bodyConfig.port ?? savedConfig.port,
      user: bodyConfig.user ?? savedConfig.user,
      pass: bodyConfig.pass ?? savedConfig.pass,
      fromEmail: bodyConfig.fromEmail ?? savedConfig.fromEmail,
      secure: bodyConfig.secure ?? savedConfig.secure,
    };

    const host = merged.host;
    const port = Number(merged.port);
    const fromEmail = merged.fromEmail;
    const toEmail = body.toEmail?.trim() || admin.email;

    if (!host || !port || !fromEmail) {
      return NextResponse.json(
        { error: "SMTP host, port, and fromEmail are required" },
        { status: 400 },
      );
    }

    const info = await sendSmtpMail(
      {
        host,
        port,
        user: merged.user,
        pass: merged.pass,
        secure: merged.secure === true || port === 465,
      },
      {
      from: fromEmail,
      to: toEmail,
      subject: "[ScrapComponent] SMTP test email",
      text: `This is a test email sent on ${new Date().toISOString()} using your admin SMTP configuration.`,
      html: `
        <h2>SMTP test successful</h2>
        <p>This email confirms your SMTP settings can send messages.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      `,
      },
    );

    return NextResponse.json({
      ok: true,
      toEmail,
      messageId: info.messageId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to send test email";
    if (message.toLowerCase().includes("wrong version number")) {
      return NextResponse.json(
        {
          error:
            "SMTP TLS mode mismatch: use secure=false for port 587 (STARTTLS) and secure=true for port 465 (implicit TLS).",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
