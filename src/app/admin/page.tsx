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
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [savingRegistration, setSavingRegistration] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as { smtp?: SmtpConfig | null; registrationEnabled?: boolean };
      if (data.smtp) {
        setConfig(data.smtp);
      }
      if (typeof data.registrationEnabled === "boolean") {
        setRegistrationEnabled(data.registrationEnabled);
      }
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

  async function saveRegistrationToggle(nextValue: boolean): Promise<void> {
    setSavingRegistration(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registrationEnabled: nextValue }),
    });

    const payload = (await res.json()) as { error?: string; registrationEnabled?: boolean };
    setSavingRegistration(false);

    if (!res.ok) {
      setError(payload.error ?? "Failed to update registration setting");
      return;
    }

    setRegistrationEnabled(typeof payload.registrationEnabled === "boolean" ? payload.registrationEnabled : nextValue);
    setSuccess(`New user registration ${nextValue ? "enabled" : "disabled"}.`);
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
            <Link href="/" className="btn-secondary text-center">Wizard</Link>
            <Link href="/jobs" className="btn-secondary text-center">Jobs</Link>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Admin Section</div>
          <div className="grid gap-2">
            <button className={activeSection === "smtp" ? "btn-primary text-left" : "btn-secondary text-left"} onClick={() => setActiveSection("smtp")}>
              Email Settings
            </button>
            <button className={activeSection === "registration" ? "btn-primary text-left" : "btn-secondary text-left"} onClick={() => setActiveSection("registration")}>
              Registration Policy
            </button>
            <button className={activeSection === "audit" ? "btn-primary text-left" : "btn-secondary text-left"} onClick={() => setActiveSection("audit")}>
              Other (coming soon)
            </button>
          </div>
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

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}

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
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Control whether new users can self-register from the auth page.
            </p>
            <label className="field mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={registrationEnabled}
                onChange={(e) => void saveRegistrationToggle(e.target.checked)}
                disabled={savingRegistration}
              />
              Allow new user registration
            </label>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              When disabled, only existing users can log in. First admin bootstrap remains unaffected.
            </p>
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
