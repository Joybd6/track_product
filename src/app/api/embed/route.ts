import { NextRequest } from "next/server";

export const runtime = "nodejs";

function pickerScript(): string {
  return `
<script>
(function () {
  const HOVER_ATTR = 'data-sc-hover';

  const css = document.createElement('style');
  css.innerHTML = '[data-sc-hover="1"]{outline:2px solid #ef4444 !important; cursor: crosshair !important;}';
  document.head.appendChild(css);

  function getSelector(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) return '#' + CSS.escape(el.id);

    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
      let part = node.tagName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        const classes = node.className.trim().split(/\\s+/).slice(0, 2).filter(Boolean);
        if (classes.length) {
          part += '.' + classes.map((c) => CSS.escape(c)).join('.');
        }
      }

      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((s) => s.tagName === node.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(node) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }

      path.unshift(part);
      node = node.parentElement;
    }
    return path.join(' > ');
  }

  function attrs(el) {
    const out = {};
    for (const a of Array.from(el.attributes || [])) {
      out[a.name] = a.value;
    }
    return out;
  }

  document.addEventListener('mouseover', function (e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const prev = document.querySelector('[' + HOVER_ATTR + '="1"]');
    if (prev) prev.removeAttribute(HOVER_ATTR);
    target.setAttribute(HOVER_ATTR, '1');
  }, true);

  document.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (!(el instanceof Element)) return;

    const payload = {
      selector: getSelector(el),
      text: (el.textContent || '').trim().slice(0, 500),
      html: (el.innerHTML || '').trim().slice(0, 2000),
      tagName: el.tagName.toLowerCase(),
      attributes: attrs(el)
    };

    window.parent.postMessage({
      type: 'scrap-picker:selected',
      payload: payload
    }, '*');
  }, true);
})();
</script>
`;
}

function injectForEmbed(html: string, targetUrl: string): string {
  const baseTag = `<base href="${targetUrl}">`;
  const script = pickerScript();

  if (html.includes("</head>")) {
    return html.replace("</head>", `${baseTag}${script}</head>`);
  }

  return `${baseTag}${script}${html}`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing url query parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response("Only http(s) URLs are supported", { status: 400 });
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ScrapComponentEmbed/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    return new Response(`Target returned status ${response.status}`, { status: 502 });
  }

  const html = await response.text();
  const embedded = injectForEmbed(html, parsed.toString());

  return new Response(embedded, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
