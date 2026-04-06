import { load } from "cheerio";
import type { TrackerConfig } from "@/types/tracking";

export function extractTrackedValue(html: string, tracker: TrackerConfig): string {
  const $ = load(html);
  const el = $(tracker.selector).first();

  if (el.length === 0) {
    throw new Error(`No element matched selector: ${tracker.selector}`);
  }

  switch (tracker.extract) {
    case "text":
      return el.text().trim();
    case "html":
      return (el.html() ?? "").trim();
    case "attribute":
      if (!tracker.attributeName) {
        throw new Error("attributeName is required when extract=attribute");
      }
      return (el.attr(tracker.attributeName) ?? "").trim();
    default:
      return "";
  }
}
