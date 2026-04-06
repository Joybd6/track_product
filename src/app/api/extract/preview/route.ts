import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import type { ProxySettings, TrackerConfig } from "@/types/tracking";
import { fetchPageHtml } from "@/lib/scrape/fetch-page";
import { extractContextData, extractTrackedValueDetailed } from "@/lib/scrape/extractors";

export const runtime = "nodejs";

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

  return {
    selector: tracker.selector,
    extract,
    attributeName: tracker.attributeName,
    regexPattern: tracker.regexPattern,
    fallbackSelectors: Array.isArray(tracker.fallbackSelectors)
      ? tracker.fallbackSelectors.filter((value): value is string => typeof value === "string")
      : [],
    contextDataPoints: Array.isArray(tracker.contextDataPoints)
      ? tracker.contextDataPoints
          .filter((point): point is NonNullable<TrackerConfig["contextDataPoints"]>[number] => !!point)
          .map((point) => ({
            key: point.key,
            selector: point.selector,
            extract: point.extract,
            attributeName: point.attributeName,
          }))
      : [],
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser();

    const body = (await request.json()) as {
      url?: string;
      tracker?: unknown;
      proxy?: unknown;
    };

    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const tracker = ensureTracker(body.tracker);
    const proxy = ensureProxy(body.proxy);

    const html = await fetchPageHtml(url, proxy);
    const extracted = extractTrackedValueDetailed(html, tracker, { allowMissing: true });
    const contextData = extractContextData(html, tracker.contextDataPoints);

    return NextResponse.json({
      value: extracted.value,
      usedSelector: extracted.usedSelector,
      found: extracted.found,
      contextData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 400 },
    );
  }
}
