"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JobRecord, JobRunLogRecord } from "@/types/tracking";

type StatusFilter = "all" | "idle" | "running" | "success" | "failed";
type CooldownUnit = "minutes" | "hours" | "days";

interface AlertPolicyDraft {
  onMatchBehavior: JobRecord["alertPolicy"]["onMatchBehavior"];
  notificationMode: JobRecord["alertPolicy"]["notificationMode"];
  cooldownValue: string;
  cooldownUnit: CooldownUnit;
}

export default function JobsPage() {
  const [currentUser, setCurrentUser] = useState<{ email: string; role: "USER" | "ADMIN" } | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResultByJob, setRunResultByJob] = useState<Record<string, string>>({});
  const [logsByJob, setLogsByJob] = useState<Record<string, JobRunLogRecord[]>>({});
  const [openLogJobId, setOpenLogJobId] = useState<string | null>(null);
  const [scheduleDraftByJob, setScheduleDraftByJob] = useState<Record<string, string>>({});
  const [savingScheduleByJob, setSavingScheduleByJob] = useState<Record<string, boolean>>({});
  const [policyDraftByJob, setPolicyDraftByJob] = useState<Record<string, AlertPolicyDraft>>({});
  const [savingPolicyByJob, setSavingPolicyByJob] = useState<Record<string, boolean>>({});

  function redirectToAuth(): void {
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  }

  function formatDateTime(value?: string): string {
    if (!value) {
      return "never";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  }

  function minutesToDraft(minutes: number): { cooldownValue: string; cooldownUnit: CooldownUnit } {
    if (minutes >= 1440 && minutes % 1440 === 0) {
      return { cooldownValue: String(minutes / 1440), cooldownUnit: "days" };
    }
    if (minutes >= 60 && minutes % 60 === 0) {
      return { cooldownValue: String(minutes / 60), cooldownUnit: "hours" };
    }

    return { cooldownValue: String(minutes), cooldownUnit: "minutes" };
  }

  function draftToMinutes(cooldownValue: string, unit: CooldownUnit): number {
    const numeric = Math.max(0, Math.floor(Number(cooldownValue || 0)));
    if (unit === "days") {
      return numeric * 1440;
    }
    if (unit === "hours") {
      return numeric * 60;
    }
    return numeric;
  }

  function formatCooldown(minutes: number): string {
    if (minutes === 0) {
      return "0 min";
    }
    if (minutes % 1440 === 0) {
      return `${minutes / 1440} day` + (minutes / 1440 === 1 ? "" : "s");
    }
    if (minutes % 60 === 0) {
      return `${minutes / 60} hour` + (minutes / 60 === 1 ? "" : "s");
    }
    return `${minutes} min`;
  }

  const loadJobs = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const payload = (await res.json()) as { jobs?: JobRecord[]; error?: string };

      if (res.status === 401) {
        redirectToAuth();
        return;
      }

      if (!res.ok) {
        setError(payload.error ?? "Failed to fetch jobs");
        setJobs([]);
        return;
      }

      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
    } catch {
      setError("Failed to fetch jobs");
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { user: { email: string; role: "USER" | "ADMIN" } };
      setCurrentUser(data.user);
    })();

    const initial = window.setTimeout(() => {
      void loadJobs();
    }, 0);

    const timer = window.setInterval(() => {
      void loadJobs();
    }, 10000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadJobs]);

  async function patchJob(id: string, body: object): Promise<void> {
    setError(null);
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = (await res.json()) as {
      error?: string;
      log?: JobRunLogRecord;
    };

    if (res.status === 401) {
      redirectToAuth();
      return;
    }

    if (!res.ok) {
      setError(payload.error ?? "Failed to update job");
      return;
    }

    if (payload.log) {
      const log = payload.log;
      setRunResultByJob((prev) => ({
        ...prev,
        [id]: log.summary,
      }));
    }

    await loadJobs();
  }

  async function loadLogs(jobId: string): Promise<void> {
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/logs?advanced=${advancedMode ? "1" : "0"}`);
    const payload = (await res.json()) as { error?: string; logs?: JobRunLogRecord[] };

    if (res.status === 401) {
      redirectToAuth();
      return;
    }

    if (!res.ok) {
      setError(payload.error ?? "Failed to fetch logs");
      return;
    }

    setLogsByJob((prev) => ({
      ...prev,
      [jobId]: payload.logs ?? [],
    }));
  }

  async function removeJob(id: string): Promise<void> {
    setError(null);
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    if (res.status === 401) {
      redirectToAuth();
      return;
    }
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string };
      setError(payload.error ?? "Failed to delete job");
      return;
    }
    await loadJobs();
  }

  async function saveSchedule(jobId: string, fallbackSchedule: string): Promise<void> {
    const schedule = (scheduleDraftByJob[jobId] ?? fallbackSchedule).trim();
    if (!schedule) {
      setError("Schedule cannot be empty");
      return;
    }

    setSavingScheduleByJob((prev) => ({ ...prev, [jobId]: true }));
    await patchJob(jobId, { schedule });
    setSavingScheduleByJob((prev) => ({ ...prev, [jobId]: false }));
    setScheduleDraftByJob((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }

  async function savePolicy(job: JobRecord): Promise<void> {
    const draft = policyDraftByJob[job.id];
    if (!draft) {
      return;
    }

    setSavingPolicyByJob((prev) => ({ ...prev, [job.id]: true }));

    await patchJob(job.id, {
      alertPolicy: {
        onMatchBehavior: draft.onMatchBehavior,
        notificationMode: draft.notificationMode,
        cooldownMinutes: draftToMinutes(draft.cooldownValue, draft.cooldownUnit),
      },
    });

    setSavingPolicyByJob((prev) => ({ ...prev, [job.id]: false }));
    setPolicyDraftByJob((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });
  }

  const filteredJobs = useMemo(() => {
    const list = Array.isArray(jobs) ? jobs : [];

    return list
      .filter((job) => {
        if (enabledOnly && !job.enabled) {
          return false;
        }
        if (statusFilter !== "all" && job.status !== statusFilter) {
          return false;
        }
        if (!query.trim()) {
          return true;
        }

        const target = `${job.name} ${job.url} ${job.tracker.selector}`.toLowerCase();
        return target.includes(query.toLowerCase());
      })
      .sort((a, b) => {
        const aDate = a.lastRunAt ?? a.createdAt;
        const bDate = b.lastRunAt ?? b.createdAt;
        return aDate < bDate ? 1 : -1;
      });
  }, [enabledOnly, jobs, query, statusFilter]);

  const stats = useMemo(() => {
    const list = Array.isArray(jobs) ? jobs : [];

    return {
      total: list.length,
      active: list.filter((j) => j.enabled).length,
      failed: list.filter((j) => j.status === "failed").length,
      totalRuns: list.reduce((sum, j) => sum + (j.runCount ?? 0), 0),
      totalTriggers: list.reduce((sum, j) => sum + (j.triggerCount ?? 0), 0),
    };
  }, [jobs]);

  return (
    <main className="mx-auto flex w-full max-w-[1300px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comprehensive Jobs Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Monitor schedules, run results, and logs from one place.</p>
          </div>
          <div className="flex gap-2">
            {currentUser?.role === "ADMIN" ? (
              <Link href="/admin" className="btn-secondary text-center">
                Admin
              </Link>
            ) : null}
            <Link href="/" className="btn-secondary text-center">
              Wizard
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="text-xs text-[var(--ink-muted)]">Total jobs</div>
            <div className="text-2xl font-semibold">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="text-xs text-[var(--ink-muted)]">Active jobs</div>
            <div className="text-2xl font-semibold">{stats.active}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="text-xs text-[var(--ink-muted)]">Failed jobs</div>
            <div className="text-2xl font-semibold">{stats.failed}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="text-xs text-[var(--ink-muted)]">Total runs</div>
            <div className="text-2xl font-semibold">{stats.totalRuns}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="text-xs text-[var(--ink-muted)]">Total triggers</div>
            <div className="text-2xl font-semibold">{stats.totalTriggers}</div>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_220px_180px_auto_auto]">
          <input
            className="field"
            placeholder="Search by name, URL, selector"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="idle">Idle</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <label className="field flex items-center gap-2">
            <input type="checkbox" checked={enabledOnly} onChange={(e) => setEnabledOnly(e.target.checked)} />
            Enabled only
          </label>
          <label className="field flex items-center gap-2">
            <input type="checkbox" checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />
            Advanced mode
          </label>
          <button className="btn-secondary" onClick={() => void loadJobs()}>
            Refresh
          </button>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        {error ? <p className="mb-3 text-sm font-medium text-red-700">{error}</p> : null}
        <div className="grid gap-3">
          {filteredJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-sm text-[var(--ink-muted)]">No jobs match your filters.</div>
          ) : (
            filteredJobs.map((job) => (
              <article key={job.id} className="rounded-xl border border-[var(--line)] bg-white p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold">{job.name}</h2>
                      <div className="truncate text-xs text-[var(--ink-muted)]">{job.url}</div>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded border border-[var(--line)] bg-[#f8f6ef] px-2 py-1">
                          <strong>Status:</strong> {job.status}
                        </div>
                        <div className="rounded border border-[var(--line)] bg-[#f8f6ef] px-2 py-1">
                          <strong>Next run:</strong> {formatDateTime(job.nextRunAt)}
                        </div>
                        <div className="rounded border border-[var(--line)] bg-[#f8f6ef] px-2 py-1">
                          <strong>Runs:</strong> {job.runCount ?? 0}
                        </div>
                        <div className="rounded border border-[var(--line)] bg-[#f8f6ef] px-2 py-1">
                          <strong>Triggers:</strong> {job.triggerCount ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-primary" onClick={() => void patchJob(job.id, { runNow: true, advancedMode })}>
                        Run now
                      </button>
                      <button className="btn-secondary" onClick={() => void patchJob(job.id, { enabled: !job.enabled })}>
                        {job.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded border border-[var(--line)] bg-[#f8f6ef] p-2 text-xs">
                    <strong>Latest result:</strong> {runResultByJob[job.id] ?? job.lastRunSummary ?? "No runs yet"}
                  </div>

                  {job.lastError ? <div className="text-xs text-red-700">Latest error: {job.lastError}</div> : null}

                  <details className="rounded-xl border border-[var(--line)] bg-[#fcfbf7]">
                    <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold">Job details and controls</summary>
                    <div className="grid gap-3 border-t border-[var(--line)] p-3 text-xs">
                      <div>
                        <div className="font-semibold">Tracking details</div>
                        <div className="mt-1 font-mono">selector: {job.tracker.selector}</div>
                        <div className="mt-1">condition: {job.condition.operator}{job.condition.value ? ` (${job.condition.value})` : ""}</div>
                        <div className="mt-1">schedule: {job.schedule}</div>
                        <div className="mt-1">last run: {formatDateTime(job.lastRunAt)}</div>
                        <div className="mt-1">last value: {job.lastValue?.slice(0, 80) ?? "-"}</div>
                        <div className="mt-1">on match: {job.alertPolicy.onMatchBehavior}</div>
                        <div className="mt-1">notify mode: {job.alertPolicy.notificationMode}</div>
                        <div className="mt-1">cooldown: {formatCooldown(job.alertPolicy.cooldownMinutes)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {scheduleDraftByJob[job.id] !== undefined ? (
                          <>
                            <input
                              className="field min-w-[220px]"
                              value={scheduleDraftByJob[job.id]}
                              onChange={(e) =>
                                setScheduleDraftByJob((prev) => ({
                                  ...prev,
                                  [job.id]: e.target.value,
                                }))
                              }
                              placeholder="*/5 * * * *"
                            />
                            <button
                              className="btn-secondary"
                              disabled={savingScheduleByJob[job.id] === true}
                              onClick={() => void saveSchedule(job.id, job.schedule)}
                            >
                              {savingScheduleByJob[job.id] === true ? "Saving..." : "Save schedule"}
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() =>
                                setScheduleDraftByJob((prev) => {
                                  const next = { ...prev };
                                  delete next[job.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn-secondary"
                            onClick={() =>
                              setScheduleDraftByJob((prev) => ({
                                ...prev,
                                [job.id]: job.schedule,
                              }))
                            }
                          >
                            Edit schedule
                          </button>
                        )}
                        {policyDraftByJob[job.id] ? (
                          <>
                            <select
                              className="field"
                              value={policyDraftByJob[job.id].onMatchBehavior}
                              onChange={(e) =>
                                setPolicyDraftByJob((prev) => ({
                                  ...prev,
                                  [job.id]: {
                                    ...prev[job.id],
                                    onMatchBehavior: e.target.value as JobRecord["alertPolicy"]["onMatchBehavior"],
                                  },
                                }))
                              }
                            >
                              <option value="continue">Keep running</option>
                              <option value="pause">Pause after alert</option>
                              <option value="disable">Disable after alert</option>
                            </select>
                            <select
                              className="field"
                              value={policyDraftByJob[job.id].notificationMode}
                              onChange={(e) =>
                                setPolicyDraftByJob((prev) => ({
                                  ...prev,
                                  [job.id]: {
                                    ...prev[job.id],
                                    notificationMode: e.target.value as JobRecord["alertPolicy"]["notificationMode"],
                                  },
                                }))
                              }
                            >
                              <option value="transition_only">Transition only</option>
                              <option value="every_match">Every match</option>
                            </select>
                            <input
                              className="field max-w-[120px]"
                              type="number"
                              min={0}
                              step={1}
                              value={policyDraftByJob[job.id].cooldownValue}
                              onChange={(e) =>
                                setPolicyDraftByJob((prev) => ({
                                  ...prev,
                                  [job.id]: {
                                    ...prev[job.id],
                                    cooldownValue: e.target.value,
                                  },
                                }))
                              }
                            />
                            <select
                              className="field"
                              value={policyDraftByJob[job.id].cooldownUnit}
                              onChange={(e) =>
                                setPolicyDraftByJob((prev) => ({
                                  ...prev,
                                  [job.id]: {
                                    ...prev[job.id],
                                    cooldownUnit: e.target.value as CooldownUnit,
                                  },
                                }))
                              }
                            >
                              <option value="minutes">minutes</option>
                              <option value="hours">hours</option>
                              <option value="days">days</option>
                            </select>
                            <button
                              className="btn-secondary"
                              disabled={savingPolicyByJob[job.id] === true}
                              onClick={() => void savePolicy(job)}
                            >
                              {savingPolicyByJob[job.id] === true ? "Saving..." : "Save policy"}
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() =>
                                setPolicyDraftByJob((prev) => {
                                  const next = { ...prev };
                                  delete next[job.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              const { cooldownValue, cooldownUnit } = minutesToDraft(job.alertPolicy.cooldownMinutes);
                              setPolicyDraftByJob((prev) => ({
                                ...prev,
                                [job.id]: {
                                  onMatchBehavior: job.alertPolicy.onMatchBehavior,
                                  notificationMode: job.alertPolicy.notificationMode,
                                  cooldownValue,
                                  cooldownUnit,
                                },
                              }));
                            }}
                          >
                            Edit policy
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            const next = openLogJobId === job.id ? null : job.id;
                            setOpenLogJobId(next);
                            if (next) {
                              void loadLogs(job.id);
                            }
                          }}
                        >
                          {openLogJobId === job.id ? "Hide logs" : "View logs"}
                        </button>
                        <button className="btn-secondary" onClick={() => void removeJob(job.id)}>
                          Delete
                        </button>
                      </div>

                      {openLogJobId === job.id ? (
                        <div className="rounded-xl border border-[var(--line)] bg-[#faf9f4] p-3">
                          <div className="mb-2 text-xs text-[var(--ink-muted)]">
                            Showing up to 50 recent logs. Raw result appears only in Advanced mode.
                          </div>
                          <div className="grid gap-2">
                            {(logsByJob[job.id] ?? []).map((log) => (
                              <div key={log.id} className="rounded border border-[var(--line)] bg-white p-2 text-xs">
                                <div><strong>{log.status}</strong> at {new Date(log.finishedAt).toLocaleString()}</div>
                                <div>{log.summary}</div>
                                {log.resultPreview ? <div>Result: {log.resultPreview}</div> : null}
                                {log.error ? <div className="text-red-700">Error: {log.error}</div> : null}
                                {advancedMode && log.rawResult ? (
                                  <pre className="mt-1 overflow-x-auto rounded bg-[#f4f1e8] p-2 text-[11px]">{log.rawResult}</pre>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
