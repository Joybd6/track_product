import { NextRequest, NextResponse } from "next/server";
import {
  deleteJob,
  runNow,
  toggleJob,
  updateJobAlertPolicy,
  updateJobSchedule,
} from "@/lib/scheduler/job-store";
import { requireUser } from "@/lib/auth/guards";
import type { AlertPolicyConfig } from "@/types/tracking";

export const runtime = "nodejs";

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      enabled?: boolean;
      runNow?: boolean;
      advancedMode?: boolean;
      schedule?: string;
      alertPolicy?: unknown;
    };

    if (body.runNow) {
      const output = await runNow(
        { userId: user.userId, role: user.role },
        id,
        body.advancedMode === true,
      );
      return NextResponse.json(output);
    }

    if (typeof body.enabled === "boolean") {
      const job = await toggleJob(
        { userId: user.userId, role: user.role },
        id,
        body.enabled,
      );
      return NextResponse.json({ job });
    }

    if (typeof body.schedule === "string") {
      const job = await updateJobSchedule(
        { userId: user.userId, role: user.role },
        id,
        body.schedule,
      );
      return NextResponse.json({ job });
    }

    if (typeof body.alertPolicy !== "undefined") {
      const job = await updateJobAlertPolicy(
        { userId: user.userId, role: user.role },
        id,
        ensureAlertPolicy(body.alertPolicy),
      );
      return NextResponse.json({ job });
    }

    return NextResponse.json({ error: "Invalid patch payload" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteJob({ userId: user.userId, role: user.role }, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 },
    );
  }
}
