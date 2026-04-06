"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function InstallPage() {
  const router = useRouter();
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/system/bootstrap-status", { cache: "no-store" });
      if (!res.ok) {
        return;
      }

      const payload = (await res.json()) as { isFirstRun?: boolean };
      if (payload.isFirstRun === false) {
        router.replace("/auth");
      }
    })();
  }, [router]);

  async function runInstall(): Promise<void> {
    setInstalling(true);
    setError(null);

    const res = await fetch("/api/install/bootstrap", {
      method: "POST",
    });

    const payload = (await res.json()) as { error?: string; adminEmail?: string };

    setInstalling(false);

    if (!res.ok) {
      setError(payload.error ?? "Installation failed");
      return;
    }

    setDoneEmail(payload.adminEmail ?? null);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <section className="panel p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Initial Installation</h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          This is the first run. Click install to create the default admin credential from your environment variables.
        </p>

        {doneEmail ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[#f8f6ef] p-3 text-sm">
            <p>
              Installation complete. Admin account created: <strong>{doneEmail}</strong>
            </p>
            <p className="mt-1 text-[var(--ink-muted)]">
              Login now, then you will be required to change password before continuing.
            </p>
            <button className="btn-primary mt-3" onClick={() => router.push("/auth")}>Go to Login</button>
          </div>
        ) : (
          <button className="btn-primary mt-4" onClick={() => void runInstall()} disabled={installing}>
            {installing ? "Installing..." : "Run Installation"}
          </button>
        )}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  );
}
