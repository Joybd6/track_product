"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await response.json()) as {
      error?: string;
      user?: { forcePasswordChange?: boolean };
    };
    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Authentication failed");
      return;
    }

    setLoading(false);
    if (payload.user?.forcePasswordChange === true) {
      router.push("/auth/change-password");
    } else {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <section className="panel p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Register with your email, then create stock tracking alerts.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            className={mode === "login" ? "btn-primary" : "btn-secondary"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "btn-primary" : "btn-secondary"}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            className="field"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <button className="btn-primary mt-4 w-full" onClick={() => void submit()} disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </section>
    </main>
  );
}
