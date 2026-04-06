import cron, { type ScheduledTask } from "node-cron";
import { CronExpressionParser } from "cron-parser";
import { db } from "@/lib/db";
import { mapConfigToDbInput, mapDbJobToRecord, mapLogToRecord } from "@/lib/jobs/mapper";
import { runTrackerJob } from "@/lib/tracking/run-tracker";
import type { AlertPolicyConfig, JobConfig, JobRecord, JobRunLogRecord } from "@/types/tracking";

interface Actor {
  userId: string;
  role: "USER" | "ADMIN";
}

interface SchedulerState {
  tasks: Map<string, ScheduledTask>;
  bootstrapped: boolean;
}

const globalState = globalThis as typeof globalThis & {
  __SCRAP_COMPONENT_SCHEDULER__?: SchedulerState;
};

const state: SchedulerState =
  globalState.__SCRAP_COMPONENT_SCHEDULER__ ?? {
    tasks: new Map<string, ScheduledTask>(),
    bootstrapped: false,
  };

globalState.__SCRAP_COMPONENT_SCHEDULER__ = state;

function shouldRunScheduler(): boolean {
  const disabled = process.env.RUN_SCHEDULER === "false";
  if (disabled) {
    return false;
  }

  const dyno = process.env.DYNO;
  const schedulerDyno = process.env.RUN_SCHEDULER_DYNO;
  if (dyno && schedulerDyno) {
    return dyno === schedulerDyno;
  }

  return true;
}

function ensureAccess(actor: Actor, ownerId: string): void {
  if (actor.role === "ADMIN") {
    return;
  }

  if (actor.userId !== ownerId) {
    throw new Error("FORBIDDEN");
  }
}

function computeNextRunAt(schedule: string): string | undefined {
  try {
    const interval = CronExpressionParser.parse(schedule, { currentDate: new Date() });
    return interval.next().toDate().toISOString();
  } catch {
    return undefined;
  }
}

function withNextRunAt(job: JobRecord): JobRecord {
  return {
    ...job,
    nextRunAt: computeNextRunAt(job.schedule),
  };
}

async function scheduleJob(jobId: string, schedule: string): Promise<void> {
  if (!cron.validate(schedule)) {
    throw new Error("Invalid cron schedule expression.");
  }

  state.tasks.get(jobId)?.destroy();

  const task = cron.schedule(schedule, async () => {
    await executeJob(jobId, "scheduled");
  });

  state.tasks.set(jobId, task);
}

export async function ensureSchedulerBootstrapped(): Promise<void> {
  if (state.bootstrapped) {
    return;
  }

  if (!shouldRunScheduler()) {
    state.bootstrapped = true;
    return;
  }

  const enabledJobs = await db.job.findMany({
    where: { enabled: true },
    select: { id: true, schedule: true },
  });

  for (const job of enabledJobs) {
    if (cron.validate(job.schedule)) {
      await scheduleJob(job.id, job.schedule);
    }
  }

  state.bootstrapped = true;
}

async function executeJob(jobId: string, triggerSource: "scheduled" | "manual"): Promise<JobRunLogRecord> {
  const startedAt = new Date();

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      actions: true,
      user: true,
    },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (!job.enabled) {
    const finishedAt = new Date();
    const log = await db.jobRunLog.create({
      data: {
        jobId,
        userId: job.userId,
        triggerSource,
        status: "idle",
        triggered: false,
        actionsHandled: 0,
        summary: "Job skipped because it is disabled.",
        startedAt,
        finishedAt,
      },
    });
    return mapLogToRecord(log);
  }

  await db.job.update({
    where: { id: job.id },
    data: { status: "running" },
  });

  try {
    const runtimeJob = mapDbJobToRecord({
      ...job,
      runLogs: [],
    });
    const result = await runTrackerJob(runtimeJob);
    const finishedAt = new Date();

    const summary = result.notified
      ? result.stopJobAfterRun
        ? `Condition matched. Executed ${result.handledActionCount} action(s). Job stopped by on-match behavior (${runtimeJob.alertPolicy.onMatchBehavior}).`
        : `Condition matched. Executed ${result.handledActionCount} action(s).`
      : result.conditionMatched
        ? "Condition matched, but notification skipped by mode/cooldown policy."
        : "Condition evaluated. No action triggered.";

    const rawResult = JSON.stringify({
      currentValue: result.currentValue,
      conditionMatched: result.conditionMatched,
      notified: result.notified,
      actionsHandled: result.handledActionCount,
      notificationMode: runtimeJob.alertPolicy.notificationMode,
      onMatchBehavior: runtimeJob.alertPolicy.onMatchBehavior,
      cooldownMinutes: runtimeJob.alertPolicy.cooldownMinutes,
      triggerSource,
    });

    await db.job.update({
      where: { id: job.id },
      data: {
        status: "success",
        lastError: null,
        lastValue: result.currentValue,
        lastConditionMatched: result.conditionMatched,
        lastNotifiedAt: result.notified ? finishedAt : undefined,
        lastRunAt: finishedAt,
        enabled: result.stopJobAfterRun ? false : undefined,
        runCount: { increment: 1 },
        triggerCount: result.notified ? { increment: 1 } : undefined,
      },
    });

    if (result.stopJobAfterRun) {
      state.tasks.get(job.id)?.destroy();
      state.tasks.delete(job.id);
    }

    const log = await db.jobRunLog.create({
      data: {
        jobId: job.id,
        userId: job.userId,
        triggerSource,
        status: "success",
        triggered: result.notified,
        actionsHandled: result.handledActionCount,
        summary,
        resultPreview: result.currentValue.slice(0, 280),
        rawResult,
        startedAt,
        finishedAt,
      },
    });

    return mapLogToRecord(log);
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Unknown error";

    await db.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        lastError: message,
        lastRunAt: finishedAt,
      },
    });

    const log = await db.jobRunLog.create({
      data: {
        jobId: job.id,
        userId: job.userId,
        triggerSource,
        status: "failed",
        triggered: false,
        actionsHandled: 0,
        summary: "Run failed.",
        error: message,
        startedAt,
        finishedAt,
      },
    });

    return mapLogToRecord(log);
  }
}

export async function listJobs(actor: Actor): Promise<JobRecord[]> {
  await ensureSchedulerBootstrapped();

  const jobs = await db.job.findMany({
    where: actor.role === "ADMIN" ? undefined : { userId: actor.userId },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((job) => withNextRunAt(mapDbJobToRecord(job)));
}

export async function createJob(actor: Actor, config: JobConfig): Promise<JobRecord> {
  await ensureSchedulerBootstrapped();

  if (!cron.validate(config.schedule)) {
    throw new Error("Invalid cron schedule expression.");
  }

  const created = await db.job.create({
    data: {
      ...mapConfigToDbInput(config),
      userId: actor.userId,
      actions: {
        create: config.actions.map((action) => ({
          type: action.type,
          configJson: action.config ? JSON.stringify(action.config) : null,
        })),
      },
    },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  await scheduleJob(created.id, created.schedule);
  return withNextRunAt(mapDbJobToRecord(created));
}

export async function toggleJob(actor: Actor, id: string, enabled: boolean): Promise<JobRecord> {
  await ensureSchedulerBootstrapped();

  const current = await db.job.findUnique({
    where: { id },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!current) {
    throw new Error("Job not found");
  }

  ensureAccess(actor, current.userId);

  const updated = await db.job.update({
    where: { id },
    data: { enabled },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (enabled) {
    await scheduleJob(updated.id, updated.schedule);
  } else {
    state.tasks.get(updated.id)?.destroy();
    state.tasks.delete(updated.id);
  }

  return withNextRunAt(mapDbJobToRecord(updated));
}

export async function updateJobSchedule(actor: Actor, id: string, schedule: string): Promise<JobRecord> {
  await ensureSchedulerBootstrapped();

  const normalizedSchedule = schedule.trim();
  if (!normalizedSchedule || !cron.validate(normalizedSchedule)) {
    throw new Error("Invalid cron schedule expression.");
  }

  const current = await db.job.findUnique({
    where: { id },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!current) {
    throw new Error("Job not found");
  }

  ensureAccess(actor, current.userId);

  const updated = await db.job.update({
    where: { id },
    data: { schedule: normalizedSchedule },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (updated.enabled) {
    await scheduleJob(updated.id, updated.schedule);
  }

  return withNextRunAt(mapDbJobToRecord(updated));
}

export async function updateJobAlertPolicy(
  actor: Actor,
  id: string,
  alertPolicy: AlertPolicyConfig,
): Promise<JobRecord> {
  await ensureSchedulerBootstrapped();

  const current = await db.job.findUnique({
    where: { id },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!current) {
    throw new Error("Job not found");
  }

  ensureAccess(actor, current.userId);

  const updated = await db.job.update({
    where: { id },
    data: {
      onMatchBehavior: alertPolicy.onMatchBehavior,
      notificationMode: alertPolicy.notificationMode,
      cooldownMinutes: alertPolicy.cooldownMinutes,
    },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return withNextRunAt(mapDbJobToRecord(updated));
}

export async function deleteJob(actor: Actor, id: string): Promise<void> {
  await ensureSchedulerBootstrapped();

  const current = await db.job.findUnique({ where: { id } });
  if (!current) {
    throw new Error("Job not found");
  }

  ensureAccess(actor, current.userId);
  state.tasks.get(id)?.destroy();
  state.tasks.delete(id);
  await db.job.delete({ where: { id } });
}

export async function runNow(
  actor: Actor,
  id: string,
  includeRaw = false,
): Promise<{ job: JobRecord; log: JobRunLogRecord }> {
  await ensureSchedulerBootstrapped();

  const current = await db.job.findUnique({ where: { id } });
  if (!current) {
    throw new Error("Job not found");
  }

  ensureAccess(actor, current.userId);

  const log = await executeJob(id, "manual");
  const finalLog = includeRaw ? log : { ...log, rawResult: undefined };

  const latest = await db.job.findUnique({
    where: { id },
    include: {
      actions: true,
      user: true,
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!latest) {
    throw new Error("Job not found");
  }

  return {
    job: withNextRunAt(mapDbJobToRecord(latest)),
    log: finalLog,
  };
}

export async function listJobLogs(
  actor: Actor,
  jobId: string,
  includeRaw = false,
): Promise<JobRunLogRecord[]> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error("Job not found");
  }

  ensureAccess(actor, job.userId);

  const logs = await db.jobRunLog.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return logs.map((log: {
    id: string;
    status: "idle" | "running" | "success" | "failed";
    triggered: boolean;
    actionsHandled: number;
    summary: string;
    resultPreview: string | null;
    rawResult: string | null;
    error: string | null;
    startedAt: Date;
    finishedAt: Date;
    triggerSource: string;
  }) => {
    const mapped = mapLogToRecord(log);
    if (!includeRaw) {
      mapped.rawResult = undefined;
    }
    return mapped;
  });
}
