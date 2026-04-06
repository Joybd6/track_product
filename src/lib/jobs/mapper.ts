import type {
  ActionConfig,
  ConditionConfig,
  JobConfig,
  JobRecord,
  JobRunLogRecord,
  ProxySettings,
  TrackerConfig,
} from "@/types/tracking";

interface DbJobAction {
  type: string;
  configJson: string | null;
}

interface DbUser {
  email: string;
}

interface DbRunLog {
  id: string;
  status: string;
  triggered: boolean;
  actionsHandled: number;
  summary: string;
  resultPreview: string | null;
  rawResult: string | null;
  error: string | null;
  startedAt: Date;
  finishedAt: Date;
  triggerSource: string;
}

export interface JobWithRelations {
  id: string;
  name: string;
  url: string;
  schedule: string;
  selector: string;
  extractMode: string;
  attributeName: string | null;
  conditionOperator: string;
  conditionValue: string | null;
  proxyEnabled: boolean;
  proxyProtocol: string;
  proxyHost: string | null;
  proxyPort: number | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  onMatchBehavior: string;
  notificationMode: string;
  cooldownMinutes: number;
  enabled: boolean;
  status: "idle" | "running" | "success" | "failed";
  lastValue: string | null;
  lastConditionMatched: boolean;
  lastNotifiedAt: Date | null;
  lastRunAt: Date | null;
  lastError: string | null;
  runCount: number;
  triggerCount: number;
  userId: string;
  createdAt: Date;
  actions: DbJobAction[];
  user: DbUser;
  runLogs?: DbRunLog[];
}

export function parseActionConfig(configJson?: string | null): Record<string, string> | undefined {
  if (!configJson) {
    return undefined;
  }

  try {
    return JSON.parse(configJson) as Record<string, string>;
  } catch {
    return undefined;
  }
}

export function mapDbJobToRecord(job: JobWithRelations): JobRecord {
  const tracker: TrackerConfig = {
    selector: job.selector,
    extract: job.extractMode as TrackerConfig["extract"],
    attributeName: job.attributeName ?? undefined,
  };

  const condition: ConditionConfig = {
    operator: job.conditionOperator as ConditionConfig["operator"],
    value: job.conditionValue ?? undefined,
  };

  const proxy: ProxySettings = {
    enabled: job.proxyEnabled,
    protocol: (job.proxyProtocol as "http" | "https") ?? "http",
    host: job.proxyHost ?? "",
    port: job.proxyPort ?? 8080,
    username: job.proxyUsername ?? undefined,
    password: job.proxyPassword ?? undefined,
  };

  const actions: ActionConfig[] = job.actions.map((action) => ({
    type: action.type as ActionConfig["type"],
    config: parseActionConfig(action.configJson),
  }));

  const latestRun = job.runLogs?.[0];

  return {
    id: job.id,
    name: job.name,
    url: job.url,
    schedule: job.schedule,
    tracker,
    condition,
    actions,
    proxy,
    alertPolicy: {
      onMatchBehavior: job.onMatchBehavior as JobRecord["alertPolicy"]["onMatchBehavior"],
      notificationMode: job.notificationMode as JobRecord["alertPolicy"]["notificationMode"],
      cooldownMinutes: job.cooldownMinutes,
    },
    enabled: job.enabled,
    status: job.status,
    lastValue: job.lastValue ?? undefined,
    lastConditionMatched: job.lastConditionMatched,
    lastNotifiedAt: job.lastNotifiedAt?.toISOString(),
    lastRunAt: job.lastRunAt?.toISOString(),
    lastError: job.lastError ?? undefined,
    createdAt: job.createdAt.toISOString(),
    runCount: job.runCount,
    triggerCount: job.triggerCount,
    userId: job.userId,
    userEmail: job.user.email,
    lastRunSummary: latestRun?.summary,
  };
}

export function mapConfigToDbInput(config: JobConfig) {
  return {
    name: config.name,
    url: config.url,
    schedule: config.schedule,
    selector: config.tracker.selector,
    extractMode: config.tracker.extract,
    attributeName: config.tracker.attributeName ?? null,
    conditionOperator: config.condition.operator,
    conditionValue: config.condition.value ?? null,
    proxyEnabled: config.proxy.enabled,
    proxyProtocol: config.proxy.protocol,
    proxyHost: config.proxy.host || null,
    proxyPort: config.proxy.port || null,
    proxyUsername: config.proxy.username ?? null,
    proxyPassword: config.proxy.password ?? null,
    onMatchBehavior: config.alertPolicy.onMatchBehavior,
    notificationMode: config.alertPolicy.notificationMode,
    cooldownMinutes: config.alertPolicy.cooldownMinutes,
  };
}

export function mapLogToRecord(log: DbRunLog): JobRunLogRecord {
  return {
    id: log.id,
    status: log.status as JobRunLogRecord["status"],
    triggered: log.triggered,
    actionsHandled: log.actionsHandled,
    summary: log.summary,
    resultPreview: log.resultPreview ?? undefined,
    rawResult: log.rawResult ?? undefined,
    error: log.error ?? undefined,
    startedAt: log.startedAt.toISOString(),
    finishedAt: log.finishedAt.toISOString(),
    triggerSource: log.triggerSource,
  };
}
