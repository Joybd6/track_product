"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  fromEmail: string;
  secure?: boolean;
}

type AdminSection = "smtp" | "registration" | "audit";
type RegistrationMode = "open" | "disabled" | "invite_only";

interface InviteRecord {
  id: string;
  code: string;
  label?: string;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
  usedByEmail?: string;
  revokedAt?: string;
}

interface MenuItem {
  id: AdminSection;
  label: string;
  description: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const ADMIN_MENU_GROUPS: MenuGroup[] = [
  {
    title: "Admin Controls",
    items: [
      { id: "smtp", label: "Email Settings", description: "SMTP and sender profile" },
      { id: "registration", label: "Registration Policy", description: "Open, invite-only, or disabled" },
      { id: "audit", label: "Other (coming soon)", description: "Future admin tools" },
    ],
  },
];

const APP_FEATURE_LINKS = [
  { href: "/", label: "Wizard" },
  { href: "/jobs", label: "Jobs" },
] as const;

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>("smtp");
  const [config, setConfig] = useState<SmtpConfig>({
    host: "",
    port: 587,
    user: "",
    pass: "",
    fromEmail: "",
    secure: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("open");
  const [registrationModeDraft, setRegistrationModeDraft] = useState<RegistrationMode>("open");
  const [savingRegistrationMode, setSavingRegistrationMode] = useState(false);

  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteExpiryDays, setInviteExpiryDays] = useState("7");
  const [creatingInvite, setCreatingInvite] = useState(false);

  async function loadInvites(): Promise<void> {
    const res = await fetch("/api/admin/invites", { cache: "no-store" });
    if (!res.ok) {
      return;
    }

    const payload = (await res.json()) as { invites?: InviteRecord[] };
    setInvites(Array.isArray(payload.invites) ? payload.invites : []);
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as {
        smtp?: SmtpConfig | null;
        registrationMode?: RegistrationMode;
        registrationEnabled?: boolean;
      };
      if (data.smtp) {
        setConfig(data.smtp);
      }
      if (typeof data.registrationMode === "string") {
        setRegistrationMode(data.registrationMode);
        setRegistrationModeDraft(data.registrationMode);
      } else if (typeof data.registrationEnabled === "boolean") {
        const mode: RegistrationMode = data.registrationEnabled ? "open" : "disabled";
        setRegistrationMode(mode);
        setRegistrationModeDraft(mode);
      }

      await loadInvites();
    })();
  }, []);

  async function save(): Promise<void> {
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Failed to save SMTP settings");
      return;
    }

    setSuccess("SMTP settings saved.");
  }

  async function sendTestEmail(): Promise<void> {
    setError(null);
    setSuccess(null);
    setTestResult(null);
    setTestLoading(true);

    const res = await fetch("/api/admin/settings/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toEmail: testEmail.trim() || undefined,
        config,
      }),
    });

    const payload = (await res.json()) as {
      error?: string;
      toEmail?: string;
      messageId?: string;
    };

    setTestLoading(false);

    if (!res.ok) {
      setError(payload.error ?? "Failed to send test email");
      return;
    }

    const target = payload.toEmail ?? "your account email";
    setTestResult(`Test email sent to ${target}${payload.messageId ? ` (messageId: ${payload.messageId})` : ""}.`);
  }

  async function saveRegistrationMode(): Promise<void> {
    setSavingRegistrationMode(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registrationMode: registrationModeDraft }),
    });

    const payload = (await res.json()) as {
      error?: string;
      registrationMode?: RegistrationMode;
      registrationEnabled?: boolean;
    };
    setSavingRegistrationMode(false);

    if (!res.ok) {
      setError(payload.error ?? "Failed to update registration setting");
      return;
    }

    const appliedMode: RegistrationMode =
      typeof payload.registrationMode === "string"
        ? payload.registrationMode
        : typeof payload.registrationEnabled === "boolean"
          ? payload.registrationEnabled
            ? "open"
            : "disabled"
          : registrationModeDraft;

    setRegistrationMode(appliedMode);
    setRegistrationModeDraft(appliedMode);
    setSuccess(
      `Registration mode updated to ${
        appliedMode === "open" ? "Open" : appliedMode === "invite_only" ? "Invite-only" : "Disabled"
      }.`,
    );
  }

  async function createInvite(): Promise<void> {
    setCreatingInvite(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        label: inviteLabel.trim() || undefined,
        expiresInDays: Number(inviteExpiryDays || 0),
      }),
    });

    const payload = (await res.json()) as { error?: string; invite?: InviteRecord };
    setCreatingInvite(false);

    if (!res.ok) {
      setError(payload.error ?? "Failed to create invite");
      return;
    }

    setInviteLabel("");
    await loadInvites();
    setSuccess(`Invite created: ${payload.invite?.code ?? "(hidden)"}`);
  }

  async function revokeInvite(id: string): Promise<void> {
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Failed to revoke invite");
      return;
    }

    await loadInvites();
    setSuccess("Invite revoked.");
  }

  function inviteStatus(invite: InviteRecord): "active" | "used" | "expired" | "revoked" {
    if (invite.revokedAt) {
      return "revoked";
    }
    if (invite.usedAt) {
      return "used";
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return "expired";
    }
    return "active";
  }

  return (
    <main className="mx-auto flex w-full max-w-[1300px] flex-1 gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <aside className="panel hidden w-[270px] shrink-0 p-4 lg:block">
        <div className="rounded-xl border border-[var(--line)] bg-[#fff8ef] p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Admin</div>
          <div className="mt-1 text-lg font-semibold">Control Center</div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">System-level settings and policies.</p>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">App Features</div>
          <div className="grid gap-2">
            {APP_FEATURE_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="btn-secondary text-center">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {ADMIN_MENU_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{group.title}</div>
              <div className="grid gap-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={activeSection === item.id ? "btn-primary text-left" : "btn-secondary text-left"}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <div>{item.label}</div>
                    <div className="mt-0.5 text-[10px] font-normal opacity-80">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="panel min-w-0 flex-1 p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Manage platform configuration and administrative controls.</p>

        <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
          <button className={activeSection === "smtp" ? "btn-primary" : "btn-secondary"} onClick={() => setActiveSection("smtp")}>
            Email
          </button>
          <button className={activeSection === "registration" ? "btn-primary" : "btn-secondary"} onClick={() => setActiveSection("registration")}>
            Registration
          </button>
          <button className={activeSection === "audit" ? "btn-primary" : "btn-secondary"} onClick={() => setActiveSection("audit")}>
            Other
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-[#e9d5b3] bg-[#fff6e8] px-3 py-2 text-sm text-[#6e4d1a]">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-3 rounded-xl border border-[#cfe4c4] bg-[#edf8e8] px-3 py-2 text-sm text-[#295b1b]">
            {success}
          </div>
        ) : null}

        {activeSection === "smtp" ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">SMTP and Sender Email</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Configure SMTP and sender email used for alert emails.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="field" value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })} placeholder="SMTP host" />
              <input
                className="field"
                value={String(config.port)}
                onChange={(e) => setConfig({ ...config, port: Number(e.target.value || 0) })}
                placeholder="SMTP port"
              />
              <input className="field" value={config.user ?? ""} onChange={(e) => setConfig({ ...config, user: e.target.value })} placeholder="SMTP user" />
              <input
                className="field"
                type="password"
                value={config.pass ?? ""}
                onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                placeholder="SMTP password"
              />
              <input
                className="field sm:col-span-2"
                value={config.fromEmail}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                placeholder="From email (alerts sender)"
              />
              <label className="field flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={config.secure === true}
                  onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
                />
                Use secure TLS
              </label>
            </div>

            <button className="btn-primary mt-4" onClick={() => void save()}>
              Save Email Settings
            </button>

            <div className="mt-6 rounded-xl border border-[var(--line)] bg-[#f8f6ef] p-4">
              <h3 className="text-base font-semibold">Send Test Email</h3>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Optional recipient. Leave blank to send to your own admin account email.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="field"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
                <button className="btn-secondary" onClick={() => void sendTestEmail()} disabled={testLoading}>
                  {testLoading ? "Sending..." : "Send test email"}
                </button>
              </div>
              {testResult ? <p className="mt-3 text-sm text-green-700">{testResult}</p> : null}
            </div>
          </div>
        ) : null}

        {activeSection === "registration" ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Registration Policy</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Choose how new users can register from the auth page.</p>

            <div className="mt-4 grid gap-2">
              <label className="rounded-lg border border-[var(--line)] bg-[#f8f6ef] p-3 text-sm">
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="open"
                    checked={registrationModeDraft === "open"}
                    onChange={() => setRegistrationModeDraft("open")}
                  />
                  <div>
                    <div className="font-semibold">Open registration</div>
                    <div className="text-xs text-[var(--ink-muted)]">Anyone can create an account from the auth page.</div>
                  </div>
                </div>
              </label>
              <label className="rounded-lg border border-[var(--line)] bg-[#f8f6ef] p-3 text-sm">
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="invite_only"
                    checked={registrationModeDraft === "invite_only"}
                    onChange={() => setRegistrationModeDraft("invite_only")}
                  />
                  <div>
                    <div className="font-semibold">Invite-only registration</div>
                    <div className="text-xs text-[var(--ink-muted)]">Users must provide a valid unused invite code.</div>
                  </div>
                </div>
              </label>
              <label className="rounded-lg border border-[var(--line)] bg-[#f8f6ef] p-3 text-sm">
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="disabled"
                    checked={registrationModeDraft === "disabled"}
                    onChange={() => setRegistrationModeDraft("disabled")}
                  />
                  <div>
                    <div className="font-semibold">Disabled registration</div>
                    <div className="text-xs text-[var(--ink-muted)]">Only existing users can log in. New sign-up is blocked.</div>
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[#fffaf0] px-3 py-2 text-xs text-[var(--ink-muted)]">
              Current mode: <strong>{registrationMode === "open" ? "Open" : registrationMode === "disabled" ? "Disabled" : "Invite-only"}</strong>
            </div>

            <button
              className="btn-primary mt-4"
              onClick={() => void saveRegistrationMode()}
              disabled={savingRegistrationMode || registrationModeDraft === registrationMode}
            >
              {savingRegistrationMode ? "Saving..." : "Save registration mode"}
            </button>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              In open mode, invite code is optional and still works if provided during registration.
            </p>

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[#f8f6ef] p-4">
              <h3 className="text-sm font-semibold">Invite Codes</h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">Create, review, and revoke single-use invite codes.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <input
                  className="field"
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  placeholder="Label (optional)"
                />
                <input
                  className="field"
                  type="number"
                  min={0}
                  value={inviteExpiryDays}
                  onChange={(e) => setInviteExpiryDays(e.target.value)}
                  placeholder="Expiry days"
                />
                <button className="btn-secondary" onClick={() => void createInvite()} disabled={creatingInvite}>
                  {creatingInvite ? "Creating..." : "Create invite"}
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {invites.length === 0 ? (
                  <div className="rounded border border-dashed border-[var(--line)] bg-white p-3 text-xs text-[var(--ink-muted)]">
                    No invites created yet.
                  </div>
                ) : (
                  invites.map((invite) => {
                    const status = inviteStatus(invite);
                    return (
                      <div key={invite.id} className="rounded border border-[var(--line)] bg-white p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-mono font-semibold">{invite.code}</div>
                            <div className="text-[var(--ink-muted)]">
                              {invite.label || "No label"} • created {new Date(invite.createdAt).toLocaleString()}
                            </div>
                            {invite.expiresAt ? (
                              <div className="text-[var(--ink-muted)]">expires {new Date(invite.expiresAt).toLocaleString()}</div>
                            ) : null}
                            {invite.usedAt ? <div className="text-[var(--ink-muted)]">used by {invite.usedByEmail || "unknown"}</div> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 uppercase tracking-wide">{status}</span>
                            {status === "active" ? (
                              <button className="btn-secondary" onClick={() => void revokeInvite(invite.id)}>
                                Revoke
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "audit" ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white p-6">
            <h2 className="text-base font-semibold">Other Admin Tools</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              This section is reserved for upcoming controls like audit logs, role management, and system health.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
