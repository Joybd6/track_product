import { ProxyAgent } from "undici";
import type { ProxySettings } from "@/types/tracking";

const USER_AGENT_PROFILES = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];

function toProxyUrl(proxy: ProxySettings): string {
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : "";
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

function toOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "https://www.google.com";
  }
}

export function buildBrowserRequestHeaders(url: string, userAgent: string): HeadersInit {
  const origin = toOrigin(url);
  return {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: `${origin}/`,
    Origin: origin,
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
  };
}

export async function fetchPageHtml(url: string, proxy: ProxySettings): Promise<string> {
  const init: RequestInit & { dispatcher?: ProxyAgent } = {};

  let agent: ProxyAgent | undefined;
  if (proxy.enabled && proxy.host && proxy.port) {
    agent = new ProxyAgent(toProxyUrl(proxy));
    init.dispatcher = agent;
  }

  try {
    let lastStatus = 0;

    for (const userAgent of USER_AGENT_PROFILES) {
      const response = await fetch(url, {
        ...init,
        headers: buildBrowserRequestHeaders(url, userAgent),
      });

      if (response.ok) {
        return await response.text();
      }

      lastStatus = response.status;

      if (response.status !== 403 && response.status !== 429) {
        throw new Error(`Failed to fetch page. Status ${response.status}`);
      }
    }

    throw new Error(
      `Target blocked automated requests (status ${lastStatus || 403}). Try enabling a residential proxy or use an alternate selector strategy like exists/not_exists.`,
    );
  } finally {
    await agent?.close();
  }
}
