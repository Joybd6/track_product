import { load } from "cheerio";
import type { ContextDataPoint, TrackerConfig } from "@/types/tracking";

export interface ExtractionOutput {
  value: string;
  usedSelector: string;
  found: boolean;
}

function normalizePrice(raw: string): string {
  const numeric = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const value = Number(numeric);
  if (!Number.isFinite(value)) {
    return raw.trim();
  }
  return String(value);
}

function normalizeStock(raw: string): string {
  const text = raw.trim().toLowerCase();
  if (!text) {
    return "unknown";
  }

  if (/in\s*stock|available|ready/.test(text)) {
    return "in_stock";
  }

  if (/out\s*of\s*stock|sold\s*out|unavailable/.test(text)) {
    return "out_of_stock";
  }

  if (/pre\s*order|up\s*coming|coming\s*soon/.test(text)) {
    return "preorder";
  }

  return text;
}

function applyExtractMode(rawValue: string, tracker: TrackerConfig): string {
  switch (tracker.extract) {
    case "price":
      return normalizePrice(rawValue);
    case "stock":
      return normalizeStock(rawValue);
    case "regex": {
      if (!tracker.regexPattern) {
        throw new Error("regexPattern is required when extract=regex");
      }
      const regex = new RegExp(tracker.regexPattern, "i");
      const match = rawValue.match(regex);
      if (!match) {
        return "";
      }
      return (match[1] ?? match[0] ?? "").trim();
    }
    default:
      return rawValue.trim();
  }
}

function resolveRawValue(html: string, tracker: TrackerConfig): ExtractionOutput {
  const $ = load(html);
  const candidates = [tracker.selector, ...(tracker.fallbackSelectors ?? [])]
    .map((value) => value.trim())
    .filter((value, idx, arr) => value.length > 0 && arr.indexOf(value) === idx);

  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.length === 0) {
      continue;
    }

    let raw = "";
    switch (tracker.extract) {
      case "text":
      case "price":
      case "stock":
      case "regex":
        raw = el.text();
        break;
      case "html":
        raw = el.html() ?? "";
        break;
      case "attribute":
        if (!tracker.attributeName) {
          throw new Error("attributeName is required when extract=attribute");
        }
        raw = el.attr(tracker.attributeName) ?? "";
        break;
      default:
        raw = "";
    }

    return {
      value: raw,
      usedSelector: selector,
      found: true,
    };
  }

  throw new Error(`No element matched selectors: ${candidates.join(" | ")}`);
}

function buildContextTracker(point: ContextDataPoint): TrackerConfig {
  return {
    selector: point.selector,
    extract: point.extract ?? "text",
    attributeName: point.attributeName,
  };
}

export function extractContextData(html: string, points?: ContextDataPoint[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const point of points ?? []) {
    try {
      const extracted = extractTrackedValueDetailed(html, buildContextTracker(point));
      output[point.key] = extracted.value;
    } catch {
      output[point.key] = "";
    }
  }
  return output;
}

export function extractTrackedValueDetailed(
  html: string,
  tracker: TrackerConfig,
  options?: { allowMissing?: boolean },
): ExtractionOutput {
  let resolved: ExtractionOutput;
  try {
    resolved = resolveRawValue(html, tracker);
  } catch (error) {
    if (options?.allowMissing) {
      return {
        value: "",
        usedSelector: "",
        found: false,
      };
    }
    throw error;
  }

  const value = applyExtractMode(resolved.value, tracker).trim();
  return {
    value,
    usedSelector: resolved.usedSelector,
    found: resolved.found,
  };
}

export function extractTrackedValue(html: string, tracker: TrackerConfig): string {
  return extractTrackedValueDetailed(html, tracker).value;
}
