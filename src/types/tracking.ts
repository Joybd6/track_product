export type ExtractMode = "text" | "html" | "attribute";

export type ConditionOperator =
  | "changed"
  | "contains"
  | "equals"
  | "greater_than"
  | "less_than";

export type ActionType = "console" | "webhook" | "email";

export type JobStatus = "idle" | "running" | "success" | "failed";

export type OnMatchBehavior = "continue" | "pause" | "disable";

export type NotificationMode = "transition_only" | "every_match";

export interface ProxySettings {
  enabled: boolean;
  protocol: "http" | "https";
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface TrackerConfig {
  selector: string;
  extract: ExtractMode;
  attributeName?: string;
}

export interface ConditionConfig {
  operator: ConditionOperator;
  value?: string;
}

export interface ActionConfig {
  type: ActionType;
  config?: Record<string, string>;
}

export interface AlertPolicyConfig {
  onMatchBehavior: OnMatchBehavior;
  notificationMode: NotificationMode;
  cooldownMinutes: number;
}

export interface JobConfig {
  name: string;
  url: string;
  schedule: string;
  tracker: TrackerConfig;
  condition: ConditionConfig;
  actions: ActionConfig[];
  proxy: ProxySettings;
  alertPolicy: AlertPolicyConfig;
}

export interface JobRecord extends JobConfig {
  id: string;
  enabled: boolean;
  status: JobStatus;
  lastValue?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  createdAt: string;
  runCount?: number;
  triggerCount?: number;
  userId?: string;
  userEmail?: string;
  lastRunSummary?: string;
  lastConditionMatched?: boolean;
  lastNotifiedAt?: string;
}

export interface JobRunLogRecord {
  id: string;
  status: JobStatus;
  triggered: boolean;
  actionsHandled: number;
  summary: string;
  resultPreview?: string;
  rawResult?: string;
  error?: string;
  startedAt: string;
  finishedAt: string;
  triggerSource: string;
}

export interface PickerPayload {
  selector: string;
  text: string;
  html: string;
  tagName: string;
  attributes: Record<string, string>;
}
