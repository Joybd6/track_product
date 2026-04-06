import { db } from "@/lib/db";

const SMTP_CONFIG_KEY = "smtp_config";

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  fromEmail: string;
  secure?: boolean;
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await db.appConfig.findUnique({ where: { key: SMTP_CONFIG_KEY } });
  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.value) as SmtpConfig;
  } catch {
    return null;
  }
}

export async function saveSmtpConfig(config: SmtpConfig): Promise<SmtpConfig> {
  const value = JSON.stringify(config);
  await db.appConfig.upsert({
    where: { key: SMTP_CONFIG_KEY },
    update: { value },
    create: {
      key: SMTP_CONFIG_KEY,
      value,
    },
  });
  return config;
}
