"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ContextDataPoint, PickerPayload } from "@/types/tracking";

type Operator =
  | "changed"
  | "contains"
  | "equals"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists";
type Extract = "text" | "html" | "attribute" | "price" | "stock" | "regex";
type Step = 1 | 2 | 3 | 4 | 5;
type OnMatchBehavior = "continue" | "pause" | "disable";
type NotificationMode = "transition_only" | "every_match";
type CooldownUnit = "minutes" | "hours" | "days";
type ContextExtract = "text" | "html" | "attribute" | "price" | "stock";
type SelectionTarget = { type: "main" } | { type: "context"; id: string };

interface ContextDataPointDraft {
  id: string;
  key: string;
  selector: string;
  extract: ContextExtract;
  attributeName: string;
}

const DEFAULT_CRON = "*/5 * * * *";

const stepMeta: Array<{ id: Step; title: string }> = [
  { id: 1, title: "Load Page" },
  { id: 2, title: "Pick Element" },
  { id: 3, title: "Tracking Rule" },
  { id: 4, title: "Actions + Proxy" },
  { id: 5, title: "Schedule + Create" },
];

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [inputUrl, setInputUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [selected, setSelected] = useState<PickerPayload | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget>({ type: "main" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: "USER" | "ADMIN" } | null>(null);

  const [name, setName] = useState("Stock Alert Tracker");
  const [schedule, setSchedule] = useState(DEFAULT_CRON);
  const [extract, setExtract] = useState<Extract>("text");
  const [attributeName, setAttributeName] = useState("data-stock");
  const [regexPattern, setRegexPattern] = useState("");
  const [fallbackSelectorsText, setFallbackSelectorsText] = useState("");
  const [contextDataPoints, setContextDataPoints] = useState<ContextDataPointDraft[]>([]);
  const [showAdvancedTracking, setShowAdvancedTracking] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [showPolicySettings, setShowPolicySettings] = useState(false);
  const [showProxySettings, setShowProxySettings] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const [previewSelector, setPreviewSelector] = useState<string | null>(null);
  const [previewFound, setPreviewFound] = useState<boolean | null>(null);
  const [previewContextData, setPreviewContextData] = useState<Record<string, string>>({});
  const [operator, setOperator] = useState<Operator>("contains");
  const [conditionValue, setConditionValue] = useState("in stock");

  const [enableConsoleAction, setEnableConsoleAction] = useState(false);
  const [enableWebhookAction, setEnableWebhookAction] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enableEmailAction, setEnableEmailAction] = useState(true);
  const [emailSubject, setEmailSubject] = useState("Product is back in stock");
  const [emailTo, setEmailTo] = useState("");
  const [onMatchBehavior, setOnMatchBehavior] = useState<OnMatchBehavior>("continue");
  const [notificationMode, setNotificationMode] = useState<NotificationMode>("transition_only");
  const [cooldownValue, setCooldownValue] = useState("0");
  const [cooldownUnit, setCooldownUnit] = useState<CooldownUnit>("minutes");

  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyProtocol, setProxyProtocol] = useState<"http" | "https">("http");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("8080");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");

  const embedUrl = useMemo(() => {
    if (!loadedUrl) {
      return "";
    }
    return `/api/embed?url=${encodeURIComponent(loadedUrl)}`;
  }, [loadedUrl]);

  const activeContextPick = useMemo(() => {
    if (selectionTarget.type !== "context") {
      return null;
    }
    return contextDataPoints.find((point) => point.id === selectionTarget.id) ?? null;
  }, [contextDataPoints, selectionTarget]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = (await res.json()) as {
          user: { email: string; role: "USER" | "ADMIN" };
        };
        setCurrentUser(data.user);
      }
    })();

    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; payload?: PickerPayload };
      if (data?.type === "scrap-picker:selected" && data.payload) {
        if (selectionTarget.type === "context") {
          const targetId = selectionTarget.id;
          setContextDataPoints((prev) =>
            prev.map((point) => (point.id === targetId ? { ...point, selector: data.payload!.selector } : point)),
          );
          setSelectionTarget({ type: "main" });
          setStep(3);
          return;
        }

        setSelected(data.payload);
        if (step < 3) {
          setStep(3);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [selectionTarget, step]);

  function applyStockPreset(): void {
    setName("In-Stock Email Alert");
    setOperator("contains");
    setConditionValue("in stock");
    setExtract("text");
    setEnableEmailAction(true);
    setEnableConsoleAction(false);
    setEnableWebhookAction(false);
    setEmailSubject("Product now in stock");
    setEmailTo("");
    setOnMatchBehavior("continue");
    setNotificationMode("transition_only");
    setCooldownValue("0");
    setCooldownUnit("minutes");
    setRegexPattern("");
    setContextDataPoints([]);
  }

  function makePointId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function addContextDataPoint(defaults?: Partial<ContextDataPointDraft>): void {
    setContextDataPoints((prev) => [
      ...prev,
      {
        id: makePointId(),
        key: defaults?.key ?? `field_${prev.length + 1}`,
        selector: defaults?.selector ?? "",
        extract: defaults?.extract ?? "text",
        attributeName: defaults?.attributeName ?? "",
      },
    ]);
  }

  function updateContextDataPoint(id: string, patch: Partial<ContextDataPointDraft>): void {
    setContextDataPoints((prev) => prev.map((point) => (point.id === id ? { ...point, ...patch } : point)));
  }

  function removeContextDataPoint(id: string): void {
    setContextDataPoints((prev) => prev.filter((point) => point.id !== id));
    if (selectionTarget.type === "context" && selectionTarget.id === id) {
      setSelectionTarget({ type: "main" });
    }
  }

  function pickMainSelector(): void {
    setSelectionTarget({ type: "main" });
    setStep(2);
  }

  function pickContextSelector(id: string): void {
    setSelectionTarget({ type: "context", id });
    setStep(2);
  }

  function parseFallbackSelectors(raw: string): string[] {
    return raw
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value, idx, arr) => value.length > 0 && arr.indexOf(value) === idx);
  }

  function parseContextDataPoints(points: ContextDataPointDraft[]): ContextDataPoint[] {
    return points
      .map((point) => ({
        key: point.key.trim(),
        selector: point.selector.trim(),
        extract: point.extract,
        attributeName: point.extract === "attribute" ? point.attributeName.trim() : undefined,
      }))
      .filter((point) => point.key.length > 0 && point.selector.length > 0);
  }

  async function previewExtraction(): Promise<void> {
    setError(null);
    setPreviewLoading(true);
    setPreviewValue(null);
    setPreviewSelector(null);
    setPreviewFound(null);
    setPreviewContextData({});

    if (!loadedUrl || !selected?.selector) {
      setPreviewLoading(false);
      setError("Load URL and select an element first.");
      return;
    }

    const response = await fetch("/api/extract/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: loadedUrl,
        tracker: {
          selector: selected.selector,
          fallbackSelectors: parseFallbackSelectors(fallbackSelectorsText),
          extract,
          attributeName: extract === "attribute" ? attributeName : undefined,
          regexPattern: extract === "regex" ? regexPattern : undefined,
          contextDataPoints: parseContextDataPoints(contextDataPoints),
        },
        proxy: {
          enabled: proxyEnabled,
          protocol: proxyProtocol,
          host: proxyHost,
          port: Number(proxyPort || 0),
          username: proxyUsername || undefined,
          password: proxyPassword || undefined,
        },
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      value?: string;
      usedSelector?: string;
      found?: boolean;
      contextData?: Record<string, string>;
    };

    setPreviewLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Preview failed");
      return;
    }

    setPreviewValue(payload.value ?? "");
    setPreviewSelector(payload.usedSelector ?? null);
    setPreviewFound(payload.found ?? Boolean(payload.usedSelector));
    setPreviewContextData(payload.contextData ?? {});
  }

  function cooldownToMinutes(value: string, unit: CooldownUnit): number {
    const numeric = Math.max(0, Math.floor(Number(value || 0)));
    if (unit === "days") {
      return numeric * 1440;
    }
    if (unit === "hours") {
      return numeric * 60;
    }
    return numeric;
  }

  function scheduleHint(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return "Schedule is empty";
    }

    if (normalized === "*/5 * * * *") {
      return "Runs every 5 minutes";
    }

    if (normalized === "0 * * * *") {
      return "Runs at the start of every hour";
    }

    if (normalized === "0 0 * * *") {
      return "Runs once daily at 00:00";
    }

    if (normalized === "0 9 * * 1-5") {
      return "Runs at 09:00 on weekdays";
    }

    return "Custom cron schedule";
  }

  function canMoveTo(targetStep: Step): boolean {
    if (targetStep === 1) {
      return true;
    }
    if (targetStep === 2) {
      return !!loadedUrl;
    }
    if (targetStep === 3) {
      return !!selected?.selector;
    }
    if (targetStep === 4) {
      return !!selected?.selector;
    }
    return true;
  }

  async function createTracker(): Promise<void> {
    setError(null);
    setSuccess(null);

    if (!loadedUrl) {
      setError("Load a target URL first.");
      return;
    }

    if (!selected?.selector) {
      setError("Pick an element from the embedded page first.");
      return;
    }

    const actions: Array<{
      type: "console" | "webhook" | "email";
      config?: Record<string, string>;
    }> = [];

    if (enableConsoleAction) {
      actions.push({ type: "console" });
    }
    if (enableWebhookAction) {
      actions.push({ type: "webhook", config: { url: webhookUrl } });
    }
    if (enableEmailAction) {
      actions.push({
        type: "email",
        config: {
          subject: emailSubject,
          ...(emailTo.trim() ? { to: emailTo.trim() } : {}),
        },
      });
    }

    if (actions.length === 0) {
      setError("Select at least one action.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        url: loadedUrl,
        schedule,
        tracker: {
          selector: selected.selector,
          fallbackSelectors: parseFallbackSelectors(fallbackSelectorsText),
          extract,
          attributeName: extract === "attribute" ? attributeName : undefined,
          regexPattern: extract === "regex" ? regexPattern : undefined,
          contextDataPoints: parseContextDataPoints(contextDataPoints),
        },
        condition: {
          operator,
          value: ["contains", "equals", "greater_than", "less_than"].includes(operator)
            ? conditionValue
            : undefined,
        },
        actions,
        alertPolicy: {
          onMatchBehavior,
          notificationMode,
          cooldownMinutes: cooldownToMinutes(cooldownValue, cooldownUnit),
        },
        proxy: {
          enabled: proxyEnabled,
          protocol: proxyProtocol,
          host: proxyHost,
          port: Number(proxyPort || 0),
          username: proxyUsername || undefined,
          password: proxyPassword || undefined,
        },
      }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSaving(false);
      setError(payload.error ?? "Failed to create tracker");
      return;
    }

    setSaving(false);
    setSuccess("Tracker created successfully. Open the jobs dashboard to manage schedules and runs.");
    setStep(5);
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth";
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tracker Wizard</h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Build your tracker step-by-step so setup stays simple and focused.
            </p>
            {currentUser ? (
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Signed in as {currentUser.email} ({currentUser.role})
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {currentUser?.role === "ADMIN" ? (
              <Link className="btn-secondary text-center" href="/admin">
                Admin
              </Link>
            ) : null}
            <Link className="btn-secondary text-center" href="/jobs">
              Jobs
            </Link>
            <button className="btn-secondary" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {stepMeta.map((s) => {
            const active = s.id === step;
            const completed = s.id < step;
            return (
              <button
                key={s.id}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : completed
                      ? "border-[var(--line)] bg-white"
                      : "border-[var(--line)] bg-[#f8f6ef]"
                }`}
                onClick={() => {
                  if (canMoveTo(s.id)) {
                    setStep(s.id);
                    setError(null);
                  }
                }}
              >
                <div className="font-semibold">Step {s.id}</div>
                <div className="text-xs text-[var(--ink-muted)]">{s.title}</div>
              </button>
            );
          })}
        </div>
      </section>

      {step === 1 ? (
        <section className="panel p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Step 1: Load Target Page</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Paste a product URL and load it into the embedded picker.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="field min-w-0 flex-1"
              placeholder="https://example.com/product-page"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={() => {
                setLoadedUrl(inputUrl.trim());
                setError(null);
                setSuccess(null);
                setSelectionTarget({ type: "main" });
                setStep(2);
              }}
            >
              Load Page
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel overflow-hidden p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Step 2: Pick Selector</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {selectionTarget.type === "main"
              ? "Click any product element in the embedded page to set the main tracker selector."
              : "Click an element for the active extra data point. You will return to step 3 after selection."}
          </p>
          {selectionTarget.type === "context" ? (
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[#f4f1e8] px-3 py-2 text-xs text-[var(--ink-muted)]">
              Picking for: <strong>{activeContextPick?.key || "data point"}</strong>
            </div>
          ) : null}
          {embedUrl ? (
            <iframe
              title="Embedded target page"
              src={embedUrl}
              className="mt-3 h-[560px] w-full rounded-xl border border-[var(--line)] bg-white"
              sandbox="allow-scripts allow-forms allow-popups"
            />
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-muted)]">
              No URL loaded yet. Go back to step 1.
            </div>
          )}
          {selectionTarget.type === "main" ? (
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[#f8f6ef] p-3">
              <div className="text-xs font-semibold text-[var(--ink-muted)]">Manual selector entry</div>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Use this when the target element appears only in another state (for example Add to cart button when item is available).
              </p>
              <input
                className="field mt-2 w-full"
                value={selected?.selector ?? ""}
                onChange={(e) =>
                  setSelected((prev) => ({
                    selector: e.target.value,
                    text: prev?.text ?? "",
                    html: prev?.html ?? "",
                    tagName: prev?.tagName ?? "",
                    attributes: prev?.attributes ?? {},
                  }))
                }
                placeholder="Example: button.add-to-cart"
              />
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                if (selectionTarget.type === "context") {
                  setSelectionTarget({ type: "main" });
                  setStep(3);
                  return;
                }
                setStep(1);
              }}
            >
              Back
            </button>
            {selectionTarget.type === "main" ? (
              <button className="btn-primary" onClick={() => setStep(3)} disabled={!selected?.selector}>
                Continue
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Step 3: Tracking Rule</h2>
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Picked selector</div>
              <button className="btn-secondary" onClick={pickMainSelector}>
                Re-pick main selector
              </button>
            </div>
            <div className="mt-1 break-all font-mono text-xs">{selected?.selector ?? "No element selected"}</div>
            <input
              className="field mt-2 w-full"
              value={selected?.selector ?? ""}
              onChange={(e) =>
                setSelected((prev) => ({
                  selector: e.target.value,
                  text: prev?.text ?? "",
                  html: prev?.html ?? "",
                  tagName: prev?.tagName ?? "",
                  attributes: prev?.attributes ?? {},
                }))
              }
              placeholder="Edit selector manually"
            />
            <div className="mt-2 text-xs text-[var(--ink-muted)]">Preview text: {selected?.text?.slice(0, 140) || "-"}</div>
          </div>

          <div className="mt-3">
            <button className="btn-secondary" onClick={applyStockPreset}>
              Apply In-Stock Alert Preset
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tracker name" />
            <select className="field" value={extract} onChange={(e) => setExtract(e.target.value as Extract)}>
              <option value="text">Extract text</option>
              <option value="html">Extract html</option>
              <option value="attribute">Extract attribute</option>
              <option value="price">Smart: price</option>
              <option value="stock">Smart: stock status</option>
              <option value="regex">Smart: regex capture</option>
            </select>
            <details className="sm:col-span-2 rounded-xl border border-[var(--line)] bg-white" open={showAdvancedTracking}>
              <summary
                className="cursor-pointer list-none px-3 py-2 text-sm font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  setShowAdvancedTracking((prev) => !prev);
                }}
              >
                {showAdvancedTracking ? "Hide advanced extraction" : "Show advanced extraction"}
              </summary>
              {showAdvancedTracking ? (
                <div className="grid gap-2 border-t border-[var(--line)] px-3 py-3">
                  {extract === "attribute" ? (
                    <input
                      className="field"
                      value={attributeName}
                      onChange={(e) => setAttributeName(e.target.value)}
                      placeholder="Attribute name"
                    />
                  ) : null}
                  {extract === "regex" ? (
                    <input
                      className="field"
                      value={regexPattern}
                      onChange={(e) => setRegexPattern(e.target.value)}
                      placeholder="Regex pattern (first capture group is used if present)"
                    />
                  ) : null}
                  <textarea
                    className="field min-h-[80px]"
                    value={fallbackSelectorsText}
                    onChange={(e) => setFallbackSelectorsText(e.target.value)}
                    placeholder="Fallback selectors (one CSS selector per line)"
                  />
                </div>
              ) : null}
            </details>
            <div className="sm:col-span-2 rounded-xl border border-[var(--line)] bg-[#faf9f4] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Extra Data Points On Trigger</div>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Capture additional fields using dedicated selectors. These values are included in actions and logs.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary"
                    onClick={() => addContextDataPoint({ selector: selected?.selector ?? "" })}
                  >
                    + Add data point
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {contextDataPoints.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-3 text-xs text-[var(--ink-muted)] transition-all">
                    No extra data points added yet.
                  </div>
                ) : (
                  contextDataPoints.map((point, index) => (
                    <div
                      key={point.id}
                      className="rounded-lg border border-[var(--line)] bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--ink-muted)]">Data point #{index + 1}</span>
                        <div className="flex items-center gap-2">
                          {selectionTarget.type === "context" && selectionTarget.id === point.id ? (
                            <span className="rounded-full bg-[#f4f1e8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                              Picking...
                            </span>
                          ) : null}
                          <button
                            className="text-xs text-red-700 transition hover:opacity-80"
                            onClick={() => removeContextDataPoint(point.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <input
                          className="field"
                          value={point.key}
                          onChange={(e) => updateContextDataPoint(point.id, { key: e.target.value })}
                          placeholder="Key (e.g. price)"
                        />
                        <input
                          className="field sm:col-span-2"
                          value={point.selector}
                          onChange={(e) => updateContextDataPoint(point.id, { selector: e.target.value })}
                          placeholder="CSS selector"
                        />
                        <select
                          className="field"
                          value={point.extract}
                          onChange={(e) => updateContextDataPoint(point.id, { extract: e.target.value as ContextExtract })}
                        >
                          <option value="text">text</option>
                          <option value="html">html</option>
                          <option value="attribute">attribute</option>
                          <option value="price">price</option>
                          <option value="stock">stock</option>
                        </select>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {point.extract === "attribute" ? (
                          <input
                            className="field max-w-[260px]"
                            value={point.attributeName}
                            onChange={(e) => updateContextDataPoint(point.id, { attributeName: e.target.value })}
                            placeholder="Attribute name"
                          />
                        ) : null}
                        <button
                          className="btn-secondary"
                          onClick={() => pickContextSelector(point.id)}
                        >
                          Pick from page
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            if (!selected?.selector) {
                              return;
                            }
                            updateContextDataPoint(point.id, { selector: selected.selector });
                          }}
                          disabled={!selected?.selector}
                        >
                          Use selected selector
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <select className="field" value={operator} onChange={(e) => setOperator(e.target.value as Operator)}>
              <option value="changed">changed</option>
              <option value="contains">contains</option>
              <option value="equals">equals</option>
              <option value="greater_than">greater_than</option>
              <option value="less_than">less_than</option>
              <option value="exists">exists (element is present)</option>
              <option value="not_exists">not_exists (element is absent)</option>
            </select>
            {["contains", "equals", "greater_than", "less_than"].includes(operator) ? (
              <input
                className="field"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="Condition value"
              />
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary" onClick={() => void previewExtraction()}>
                {previewLoading ? "Previewing..." : "Preview extraction"}
              </button>
              {previewSelector ? <span className="text-xs text-[var(--ink-muted)]">Matched selector: {previewSelector}</span> : null}
            </div>
            {previewFound === false ? (
              <div className="mt-2 text-xs text-[var(--ink-muted)]">
                Selector not found in the current page state. This is expected for conditional elements (for example an Add to cart button that appears only when available).
              </div>
            ) : null}
            {previewValue !== null ? (
              <div className="mt-2 text-xs">
                <strong>Preview value:</strong> {previewValue || "(empty)"}
              </div>
            ) : null}
            {Object.keys(previewContextData).length > 0 ? (
              <pre className="mt-2 overflow-x-auto rounded bg-[#f4f1e8] p-2 text-[11px]">
                {JSON.stringify(previewContextData, null, 2)}
              </pre>
            ) : null}
          </div>

          <div className="floating-action-bar sticky bottom-2 z-10 mt-4 flex gap-2 p-2">
            <button className="btn-secondary" onClick={pickMainSelector}>
              Back
            </button>
            <button className="btn-primary" onClick={() => setStep(4)}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="panel p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Step 4: Actions and Proxy</h2>

          <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
            <div className="text-sm font-semibold">Actions</div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableConsoleAction} onChange={(e) => setEnableConsoleAction(e.target.checked)} />
              Console log action
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableWebhookAction} onChange={(e) => setEnableWebhookAction(e.target.checked)} />
              Webhook action
            </label>
            {enableWebhookAction ? (
              <input
                className="field mt-2 w-full"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-endpoint.com/hook"
              />
            ) : null}

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableEmailAction} onChange={(e) => setEnableEmailAction(e.target.checked)} />
              Email action
            </label>
            {enableEmailAction ? (
              <div className="mt-2 grid gap-2">
                <input
                  className="field"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject"
                />
                <input
                  className="field"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="Recipient email (optional, defaults to your account email)"
                />
                <p className="text-xs text-[var(--ink-muted)]">
                  SMTP and sender email are configured by admin. Leave recipient blank to send to your account email.
                </p>
              </div>
            ) : null}
          </div>

          <details className="mt-4 rounded-xl border border-[var(--line)] bg-white" open={showAdvancedActions}>
            <summary
              className="cursor-pointer list-none px-3 py-2 text-sm font-semibold"
              onClick={(e) => {
                e.preventDefault();
                setShowAdvancedActions((prev) => !prev);
              }}
            >
              {showAdvancedActions ? "Hide advanced settings" : "Show advanced settings"}
            </summary>
            {showAdvancedActions ? (
              <div className="grid gap-3 border-t border-[var(--line)] px-3 py-3">
                <details className="rounded-lg border border-[var(--line)]" open={showPolicySettings}>
                  <summary
                    className="cursor-pointer list-none px-3 py-2 text-sm font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPolicySettings((prev) => !prev);
                    }}
                  >
                    {showPolicySettings ? "Hide notification policy" : "Show notification policy"}
                  </summary>
                  {showPolicySettings ? (
                    <div className="grid gap-2 border-t border-[var(--line)] p-3 sm:grid-cols-2">
                      <select
                        className="field"
                        value={onMatchBehavior}
                        onChange={(e) => setOnMatchBehavior(e.target.value as OnMatchBehavior)}
                      >
                        <option value="continue">Keep running job</option>
                        <option value="pause">Pause job after alert</option>
                        <option value="disable">Disable job after alert</option>
                      </select>
                      <select
                        className="field"
                        value={notificationMode}
                        onChange={(e) => setNotificationMode(e.target.value as NotificationMode)}
                      >
                        <option value="transition_only">Notify only on transition (false -&gt; true)</option>
                        <option value="every_match">Notify every matched run</option>
                      </select>
                      <input
                        className="field"
                        type="number"
                        min={0}
                        step={1}
                        value={cooldownValue}
                        onChange={(e) => setCooldownValue(e.target.value)}
                        placeholder="Cooldown"
                      />
                      <select
                        className="field"
                        value={cooldownUnit}
                        onChange={(e) => setCooldownUnit(e.target.value as CooldownUnit)}
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                      <p className="sm:col-span-2 text-xs text-[var(--ink-muted)]">
                        Cooldown blocks repeated alerts for the configured minutes after a notification is sent.
                      </p>
                    </div>
                  ) : null}
                </details>

                <details className="rounded-lg border border-[var(--line)]" open={showProxySettings}>
                  <summary
                    className="cursor-pointer list-none px-3 py-2 text-sm font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowProxySettings((prev) => !prev);
                    }}
                  >
                    {showProxySettings ? "Hide proxy settings" : "Show proxy settings"}
                  </summary>
                  {showProxySettings ? (
                    <div className="border-t border-[var(--line)] p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} />
                        Enable proxy for this tracker
                      </label>
                      {proxyEnabled ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <select className="field" value={proxyProtocol} onChange={(e) => setProxyProtocol(e.target.value as "http" | "https")}>
                            <option value="http">http</option>
                            <option value="https">https</option>
                          </select>
                          <input className="field" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} placeholder="Proxy host" />
                          <input className="field" value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} placeholder="Port" />
                          <input className="field" value={proxyUsername} onChange={(e) => setProxyUsername(e.target.value)} placeholder="Username" />
                          <input
                            className="field sm:col-span-2"
                            type="password"
                            value={proxyPassword}
                            onChange={(e) => setProxyPassword(e.target.value)}
                            placeholder="Password"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </details>
              </div>
            ) : null}
          </details>

          <div className="floating-action-bar sticky bottom-2 z-10 mt-4 flex gap-2 p-2">
            <button className="btn-secondary" onClick={() => setStep(3)}>
              Back
            </button>
            <button className="btn-primary" onClick={() => setStep(5)}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="panel p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Step 5: Schedule and Create</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Review and create your scheduled tracker.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="field" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Cron schedule (e.g. */5 * * * *)" />
            <input className="field" value={loadedUrl} disabled />
          </div>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">{scheduleHint(schedule)}</p>

          <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-sm">
            <div><strong>Name:</strong> {name}</div>
            <div><strong>Selector:</strong> {selected?.selector ?? "-"}</div>
            <div><strong>Rule:</strong> {operator}{conditionValue ? ` (${conditionValue})` : ""}</div>
            <div><strong>Actions:</strong> {[enableConsoleAction && "console", enableWebhookAction && "webhook", enableEmailAction && "email"].filter(Boolean).join(", ") || "none"}</div>
            <div><strong>Proxy:</strong> {proxyEnabled ? `${proxyProtocol}://${proxyHost}:${proxyPort}` : "disabled"}</div>
          </div>

          {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
          {success ? <p className="mt-3 text-sm font-medium text-green-700">{success}</p> : null}

          <div className="floating-action-bar sticky bottom-2 z-10 mt-4 flex gap-2 p-2">
            <button className="btn-secondary" onClick={() => setStep(4)}>
              Back
            </button>
            <button className="btn-primary" onClick={() => void createTracker()} disabled={saving}>
              {saving ? "Creating..." : "Create Scheduled Tracker"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
