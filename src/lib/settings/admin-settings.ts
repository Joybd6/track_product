import { db } from "@/lib/db";

const SMTP_CONFIG_KEY = "smtp_config";
const REGISTRATION_ENABLED_KEY = "registration_enabled";
const REGISTRATION_MODE_KEY = "registration_mode";
const REGISTRATION_INVITES_KEY = "registration_invites";

export type RegistrationMode = "open" | "disabled" | "invite_only";

export interface RegistrationInvite {
  id: string;
  code: string;
  label?: string;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
  usedByEmail?: string;
  revokedAt?: string;
}

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

export async function getRegistrationEnabled(): Promise<boolean> {
  const mode = await getRegistrationMode();
  return mode === "open";
}

export async function saveRegistrationEnabled(enabled: boolean): Promise<boolean> {
  await saveRegistrationMode(enabled ? "open" : "disabled");
  return enabled;
}

export async function getRegistrationMode(): Promise<RegistrationMode> {
  const modeRow = await db.appConfig.findUnique({ where: { key: REGISTRATION_MODE_KEY } });
  if (modeRow) {
    if (modeRow.value === "open" || modeRow.value === "disabled" || modeRow.value === "invite_only") {
      return modeRow.value;
    }
  }

  const legacyRow = await db.appConfig.findUnique({ where: { key: REGISTRATION_ENABLED_KEY } });
  if (!legacyRow) {
    return "open";
  }

  return legacyRow.value === "true" ? "open" : "disabled";
}

export async function saveRegistrationMode(mode: RegistrationMode): Promise<RegistrationMode> {
  if (!["open", "disabled", "invite_only"].includes(mode)) {
    throw new Error("Invalid registration mode");
  }

  const legacyEnabled = mode === "open" ? "true" : "false";

  await db.appConfig.upsert({
    where: { key: REGISTRATION_MODE_KEY },
    update: { value: mode },
    create: {
      key: REGISTRATION_MODE_KEY,
      value: mode,
    },
  });

  await db.appConfig.upsert({
    where: { key: REGISTRATION_ENABLED_KEY },
    update: { value: legacyEnabled },
    create: {
      key: REGISTRATION_ENABLED_KEY,
      value: legacyEnabled,
    },
  });

  return mode;
}

async function loadInvites(): Promise<RegistrationInvite[]> {
  const row = await db.appConfig.findUnique({ where: { key: REGISTRATION_INVITES_KEY } });
  if (!row) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value) as RegistrationInvite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveInvites(invites: RegistrationInvite[]): Promise<void> {
  await db.appConfig.upsert({
    where: { key: REGISTRATION_INVITES_KEY },
    update: { value: JSON.stringify(invites) },
    create: {
      key: REGISTRATION_INVITES_KEY,
      value: JSON.stringify(invites),
    },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(invite: RegistrationInvite): boolean {
  if (!invite.expiresAt) {
    return false;
  }
  return new Date(invite.expiresAt).getTime() < Date.now();
}

function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function randomInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    chars.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  }
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

export async function listRegistrationInvites(): Promise<RegistrationInvite[]> {
  const invites = await loadInvites();
  return invites.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createRegistrationInvite(input?: {
  label?: string;
  expiresAt?: string;
}): Promise<RegistrationInvite> {
  const invites = await loadInvites();

  let code = randomInviteCode();
  const existingCodes = new Set(invites.map((invite) => normalizeInviteCode(invite.code)));
  while (existingCodes.has(code)) {
    code = randomInviteCode();
  }

  const invite: RegistrationInvite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    code,
    label: input?.label?.trim() || undefined,
    createdAt: nowIso(),
    expiresAt: input?.expiresAt,
  };

  invites.push(invite);
  await saveInvites(invites);
  return invite;
}

export async function revokeRegistrationInvite(id: string): Promise<RegistrationInvite | null> {
  const invites = await loadInvites();
  const index = invites.findIndex((invite) => invite.id === id);
  if (index === -1) {
    return null;
  }

  const current = invites[index];
  const updated: RegistrationInvite = {
    ...current,
    revokedAt: current.revokedAt ?? nowIso(),
  };
  invites[index] = updated;
  await saveInvites(invites);
  return updated;
}

export async function consumeRegistrationInvite(
  rawCode: string,
  usedByEmail?: string,
): Promise<{ ok: true; invite: RegistrationInvite } | { ok: false; reason: string }> {
  const code = normalizeInviteCode(rawCode);
  const invites = await loadInvites();
  const index = invites.findIndex((invite) => normalizeInviteCode(invite.code) === code);

  if (index === -1) {
    return { ok: false, reason: "Invalid invite code" };
  }

  const invite = invites[index];
  if (invite.revokedAt) {
    return { ok: false, reason: "Invite code has been revoked" };
  }
  if (invite.usedAt) {
    return { ok: false, reason: "Invite code has already been used" };
  }
  if (isExpired(invite)) {
    return { ok: false, reason: "Invite code has expired" };
  }

  const consumed: RegistrationInvite = {
    ...invite,
    usedAt: nowIso(),
    usedByEmail: usedByEmail?.trim().toLowerCase() || undefined,
  };
  invites[index] = consumed;
  await saveInvites(invites);

  return { ok: true, invite: consumed };
}
