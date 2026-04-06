import { ProxyAgent } from "undici";
import type { ProxySettings } from "@/types/tracking";

function toProxyUrl(proxy: ProxySettings): string {
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : "";
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

export async function fetchPageHtml(url: string, proxy: ProxySettings): Promise<string> {
  const init: RequestInit & { dispatcher?: ProxyAgent } = {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ScrapComponentBot/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  };

  let agent: ProxyAgent | undefined;
  if (proxy.enabled && proxy.host && proxy.port) {
    agent = new ProxyAgent(toProxyUrl(proxy));
    init.dispatcher = agent;
  }

  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Failed to fetch page. Status ${response.status}`);
    }
    return await response.text();
  } finally {
    await agent?.close();
  }
}
