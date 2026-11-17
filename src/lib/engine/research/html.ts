// HTML -> readable plain text, and same-site link discovery. No dependencies.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr|\/header|\/footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(body)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageTitle(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]!.replace(/\s+/g, " ").trim()) : "";
}

export function metaDescription(html: string) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return m ? decodeEntities(m[1]!.trim()) : "";
}

const USEFUL = /(about|company|story|team|customers|case-stud|clients|work|blog|news|careers|jobs|product|services|solutions)/i;

/** Up to `limit` same-domain links that look useful for research (about, blog, case studies, careers). */
export function usefulLinks(html: string, baseUrl: string, limit = 2) {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const scored: { url: string; score: number }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1]!, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|zip|mp4|webp)$/i.test(url.pathname)) continue;
    url.hash = "";
    url.search = "";
    const key = url.toString().replace(/\/$/, "");
    if (key === base.toString().replace(/\/$/, "") || seen.has(key)) continue;
    seen.add(key);
    const label = `${url.pathname} ${m[2]!.replace(/<[^>]+>/g, " ")}`;
    const score = (USEFUL.test(label) ? 10 : 0) - url.pathname.split("/").length;
    if (score > 0) scored.push({ url: key, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.url);
}
