"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registrationMode, setRegistrationMode] = useState<"open" | "disabled" | "invite_only" | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [transitioningAfterAuth, setTransitioningAfterAuth] = useState(false);
  const showSkeleton = initializing || transitioningAfterAuth;

  useEffect(() => {
    void (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const mePayload = (await meRes.json()) as {
            user?: { forcePasswordChange?: boolean };
          };
          if (mePayload.user?.forcePasswordChange === true) {
            router.replace("/auth/change-password");
            return;
          }
          router.replace("/");
          return;
        }

        const res = await fetch("/api/system/bootstrap-status", { cache: "no-store" });
        if (!res.ok) {
          setRegistrationMode("open");
          return;
        }

        const data = (await res.json()) as {
          registrationMode?: "open" | "disabled" | "invite_only";
          registrationEnabled?: boolean;
        };

        if (typeof data.registrationMode === "string") {
          setRegistrationMode(data.registrationMode);
          if (data.registrationMode === "disabled") {
            setMode("login");
          }
        } else if (typeof data.registrationEnabled === "boolean") {
          setRegistrationMode(data.registrationEnabled ? "open" : "disabled");
        } else {
          setRegistrationMode("open");
        }
      } finally {
        setInitializing(false);
      }
    })();
  }, [router]);

  function registrationBlockedMessage(currentMode: "disabled"): string {
    return "New registration is currently disabled by the admin.";
  }

  function selectMode(next: "login" | "register"): void {
    if (next === mode) {
      return;
    }

    if (next === "register" && registrationMode === "disabled") {
      setMode("login");
      setError(registrationBlockedMessage(registrationMode));
      return;
    }

    setError(null);
    setMode(next);
  }

  async function submit(): Promise<void> {
    setError(null);
    setLoading(true);

    if (mode === "register" && registrationMode === "disabled") {
      setLoading(false);
      setError(registrationBlockedMessage(registrationMode));
      setMode("login");
      return;
    }

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, inviteCode: inviteCode.trim() || undefined }),
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

    setTransitioningAfterAuth(true);
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
          Sign in to manage trackers and alerts.
        </p>

        {showSkeleton ? (
          <div className="mt-4 space-y-3">
            <div className="h-10 w-full animate-pulse rounded-lg border border-[var(--line)] bg-[#f1eee4]" />
            <div className="h-10 w-full animate-pulse rounded-lg border border-[var(--line)] bg-[#f1eee4]" />
            <div className="h-10 w-full animate-pulse rounded-lg border border-[var(--line)] bg-[#f1eee4]" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-[#e3ddd0]" />
          </div>
        ) : (
          <>

            <div className="mt-4 flex gap-2">
              <button
                className={mode === "login" ? "btn-primary" : "btn-secondary"}
                onClick={() => selectMode("login")}
                disabled={mode === "login"}
              >
                Login
              </button>
              <button
                className={mode === "register" ? "btn-primary" : "btn-secondary"}
                onClick={() => selectMode("register")}
                disabled={mode === "register"}
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
              {mode === "register" ? (
                <input
                  className="field"
                  type="text"
                  placeholder={registrationMode === "invite_only" ? "Invite code (required)" : "Invite code (optional)"}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              ) : null}
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-[#e9d5b3] bg-[#fff6e8] px-3 py-2 text-sm text-[#6e4d1a]">
                {error}
              </div>
            ) : null}

            <button className="btn-primary mt-4 w-full" onClick={() => void submit()} disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
