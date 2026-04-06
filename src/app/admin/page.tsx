"use client";

import { useEffect, useState } from "react";

interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  fromEmail: string;
  secure?: boolean;
}

export default function AdminPage() {
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

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as { smtp?: SmtpConfig | null };
      if (data.smtp) {
        setConfig(data.smtp);
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="panel p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Configure SMTP and sender email used for alert emails.
        </p>

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

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}

        <button className="btn-primary mt-4" onClick={() => void save()}>
          Save Settings
        </button>

        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[#f8f6ef] p-4">
          <h2 className="text-base font-semibold">Send Test Email</h2>
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
      </section>
    </main>
  );
}
