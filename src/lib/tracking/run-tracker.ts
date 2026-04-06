import { runActions } from "@/lib/actions/action-registry";
import { extractContextData, extractTrackedValueDetailed } from "@/lib/scrape/extractors";
import { fetchPageHtml } from "@/lib/scrape/fetch-page";
import { shouldTrigger } from "@/lib/tracking/conditions";
import type { JobRecord } from "@/types/tracking";

export async function runTrackerJob(job: JobRecord): Promise<{
  currentValue: string;
  usedSelector: string;
  contextData: Record<string, string>;
  conditionMatched: boolean;
  notified: boolean;
  handledActionCount: number;
  stopJobAfterRun: boolean;
}> {
  const html = await fetchPageHtml(job.url, job.proxy);
  const extracted = extractTrackedValueDetailed(html, job.tracker, { allowMissing: true });
  const isExistenceOperator =
    job.condition.operator === "exists" || job.condition.operator === "not_exists";

  if (!extracted.found && !isExistenceOperator) {
    throw new Error(
      `No element matched selectors: ${[job.tracker.selector, ...(job.tracker.fallbackSelectors ?? [])].join(" | ")}`,
    );
  }

  const currentValue = extracted.value;
  const usedSelector = extracted.usedSelector;
  const contextData = extractContextData(html, job.tracker.contextDataPoints);
  const conditionMatched = shouldTrigger(job.condition, currentValue, job.lastValue, extracted.found);

  const mode = job.alertPolicy.notificationMode;
  const meetsMode =
    mode === "every_match"
      ? conditionMatched
      : conditionMatched && job.lastConditionMatched !== true;

  const cooldownMinutes = Math.max(0, Number(job.alertPolicy.cooldownMinutes || 0));
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const lastNotifiedAtMs = job.lastNotifiedAt ? new Date(job.lastNotifiedAt).getTime() : undefined;
  const cooldownPassed =
    cooldownMs === 0 ||
    typeof lastNotifiedAtMs === "undefined" ||
    Number.isNaN(lastNotifiedAtMs) ||
    Date.now() - lastNotifiedAtMs >= cooldownMs;

  const notified = meetsMode && cooldownPassed;
  let handledActionCount = 0;

  if (notified) {
    const output = await runActions({
      actions: job.actions,
      job,
      currentValue,
      previousValue: job.lastValue,
      recipientEmail: job.userEmail ?? "",
      contextData,
    });
    handledActionCount = output.handledCount;
  }

  const stopJobAfterRun =
    notified &&
    conditionMatched &&
    (job.alertPolicy.onMatchBehavior === "pause" || job.alertPolicy.onMatchBehavior === "disable");

  return {
    currentValue,
    usedSelector,
    contextData,
    conditionMatched,
    notified,
    handledActionCount,
    stopJobAfterRun,
  };
}
