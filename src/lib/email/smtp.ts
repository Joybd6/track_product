import nodemailer, { type SendMailOptions, type SentMessageInfo, type Transporter } from "nodemailer";

export interface SmtpConnectionConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure?: boolean;
}

interface BuildResult {
  transporter: Transporter;
  secure: boolean;
}

function resolveSecureFlag(config: SmtpConnectionConfig): boolean {
  if (typeof config.secure === "boolean") {
    return config.secure;
  }

  return Number(config.port) === 465;
}

function buildTransport(config: SmtpConnectionConfig, secureOverride?: boolean): BuildResult {
  const secure = typeof secureOverride === "boolean" ? secureOverride : resolveSecureFlag(config);

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port),
    secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });

  return { transporter, secure };
}

function isTlsVersionMismatch(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("wrong version number") || message.includes("tls_validate_record_header");
}

export async function sendSmtpMail(
  config: SmtpConnectionConfig,
  message: SendMailOptions,
): Promise<SentMessageInfo> {
  const primary = buildTransport(config);

  try {
    return await primary.transporter.sendMail(message);
  } catch (error) {
    const shouldRetryAsStartTls =
      primary.secure === true && Number(config.port) !== 465 && isTlsVersionMismatch(error);

    if (shouldRetryAsStartTls) {
      const fallback = buildTransport(config, false);
      return fallback.transporter.sendMail(message);
    }

    throw error;
  }
}
