import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs } from "@/lib/scheduler/job-store";
import type {
  ActionConfig,
  AlertPolicyConfig,
  ConditionConfig,
  JobConfig,
  ProxySettings,
  TrackerConfig,
} from "@/types/tracking";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";

function ensureTracker(input: unknown): TrackerConfig {
  const tracker = (input ?? {}) as Partial<TrackerConfig>;
  if (!tracker.selector) {
    throw new Error("tracker.selector is required");
  }

  const extract = tracker.extract ?? "text";
  if (!["text", "html", "attribute", "price", "stock", "regex"].includes(extract)) {
    throw new Error("tracker.extract is invalid");
  }

  if (extract === "attribute" && !tracker.attributeName) {
    throw new Error("tracker.attributeName is required for extract=attribute");
  }

  if (extract === "regex" && !tracker.regexPattern) {
    throw new Error("tracker.regexPattern is required for extract=regex");
  }

  const fallbackSelectors = Array.isArray(tracker.fallbackSelectors)
    ? tracker.fallbackSelectors
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  const contextDataPoints = Array.isArray(tracker.contextDataPoints)
    ? tracker.contextDataPoints
        .filter(
          (point): point is NonNullable<TrackerConfig["contextDataPoints"]>[number] =>
            typeof point === "object" && point !== null,
        )
        .map((point) => ({
          key: point.key?.trim() ?? "",
          selector: point.selector?.trim() ?? "",
          extract: point.extract,
          attributeName: point.attributeName,
        }))
        .filter((point) => point.key.length > 0 && point.selector.length > 0)
    : [];

  return {
    selector: tracker.selector,
    fallbackSelectors,
    extract,
    attributeName: tracker.attributeName,
    regexPattern: tracker.regexPattern,
    contextDataPoints,
  };
}

function ensureCondition(input: unknown): ConditionConfig {
  const condition = (input ?? {}) as Partial<ConditionConfig>;
  const operator = condition.operator ?? "changed";

  if (
    !["changed", "contains", "equals", "greater_than", "less_than", "exists", "not_exists"].includes(
      operator,
    )
  ) {
    throw new Error("condition.operator is invalid");
  }

  return {
    operator,
    value: condition.value,
  };
}

function ensureActions(input: unknown): ActionConfig[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [{ type: "console" }];
  }

  const actions = input as ActionConfig[];
  const normalized = actions.filter((a) => ["console", "webhook", "email"].includes(a.type));

  for (const action of normalized) {
    if (action.type === "webhook" && !action.config?.url) {
      throw new Error("webhook action requires config.url");
    }
    if (action.type === "email") {
      action.config = {
        ...(action.config ?? {}),
      };
    }
  }

  if (normalized.length === 0) {
    throw new Error("at least one valid action is required");
  }

  return normalized;
}

function ensureProxy(input: unknown): ProxySettings {
  const proxy = (input ?? {}) as Partial<ProxySettings>;
  return {
    enabled: proxy.enabled ?? false,
    protocol: proxy.protocol ?? "http",
    host: proxy.host ?? "",
    port: proxy.port ?? 8080,
    username: proxy.username,
    password: proxy.password,
  };
}

function ensureAlertPolicy(input: unknown): AlertPolicyConfig {
  const policy = (input ?? {}) as Partial<AlertPolicyConfig>;

  const onMatchBehavior = policy.onMatchBehavior ?? "continue";
  if (!["continue", "pause", "disable"].includes(onMatchBehavior)) {
    throw new Error("alertPolicy.onMatchBehavior is invalid");
  }

  const notificationMode = policy.notificationMode ?? "transition_only";
  if (!["transition_only", "every_match"].includes(notificationMode)) {
    throw new Error("alertPolicy.notificationMode is invalid");
  }

  const cooldownRaw = Number(policy.cooldownMinutes ?? 0);
  const cooldownMinutes = Number.isFinite(cooldownRaw)
    ? Math.max(0, Math.floor(cooldownRaw))
    : 0;

  return {
    onMatchBehavior,
    notificationMode,
    cooldownMinutes,
  };
}

function parsePayload(body: unknown): JobConfig {
  const payload = (body ?? {}) as Partial<JobConfig>;

  if (!payload.name?.trim()) {
    throw new Error("name is required");
  }

  if (!payload.url?.trim()) {
    throw new Error("url is required");
  }

  if (!payload.schedule?.trim()) {
    throw new Error("schedule is required");
  }

  return {
    name: payload.name.trim(),
    url: payload.url.trim(),
    schedule: payload.schedule.trim(),
    tracker: ensureTracker(payload.tracker),
    condition: ensureCondition(payload.condition),
    actions: ensureActions(payload.actions),
    proxy: ensureProxy(payload.proxy),
    alertPolicy: ensureAlertPolicy(payload.alertPolicy),
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const jobs = await listJobs({ userId: user.userId, role: user.role });
    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = (await request.json()) as unknown;
    const payload = parsePayload(body);
    const job = await createJob({ userId: user.userId, role: user.role }, payload);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bad request" },
      { status: 400 },
    );
  }
}
