import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { one, q } from "../db/pool";
import { htmlToText, metaDescription, pageTitle, usefulLinks } from "./html";
import { isAllowedByRobots } from "./robots";

// fetchPage(url): robots.txt check, 10s timeout, 1 retry, HTML -> text, cached
// in outreach.pages so each page is fetched once (docs/guide.md, Steps 5-6).

const UA = "Mozilla/5.0 (compatible; creativecut-outreach/1.0; research for a one-to-one business email)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const CACHE_DAYS = 30;

export interface Page {
  url: string;
  text: string;
  status: number;
  /** Useful same-site links (about, blog, case studies, careers). */
  links: string[];
}

/** Blocks localhost, private and link-local targets: lead websites come from uploaded CSVs. */
export async function isPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return false;
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) return false;
  return addresses.every((ip) => !isPrivateIp(ip));
}

export function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function rawFetch(url: string, attempt = 0): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 500 && attempt === 0) return rawFetch(url, 1);
    return res;
  } catch (err) {
    if (attempt === 0) return rawFetch(url, 1);
    throw err;
  }
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

const robotsCache = new Map<string, string>();

async function robotsAllows(url: URL) {
  const origin = url.origin;
  if (!robotsCache.has(origin)) {
    let txt = "";
    try {
      const res = await rawFetch(`${origin}/robots.txt`);
      if (res.ok) txt = (await readCapped(res)).slice(0, 200_000);
    } catch {
      // Unreachable robots.txt = no restrictions.
    }
    robotsCache.set(origin, txt);
  }
  return isAllowedByRobots(robotsCache.get(origin)!, url.pathname + url.search);
}

/** Fetches a page as text, from cache when fresh. Returns null when disallowed or unreachable. */
export async function fetchPage(url: string): Promise<Page | null> {
  const cached = await one<{ text: string; status: number; links: string[] | null }>(
    `select text, status, links from outreach.pages where url = $1 and fetched_at > now() - make_interval(days => $2)`,
    [url, CACHE_DAYS],
  );
  if (cached) return cached.text ? { url, text: cached.text, status: cached.status, links: cached.links ?? [] } : null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol) || !(await isPublicHost(parsed.hostname))) return null;
  if (!(await robotsAllows(parsed))) {
    await savePage(url, "", 999, []);
    return null;
  }

  try {
    const res = await rawFetch(url);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/text\/html|text\/plain|application\/xhtml/.test(type)) {
      await savePage(url, "", res.status, []);
      return null;
    }
    const html = await readCapped(res);
    const title = pageTitle(html);
    const desc = metaDescription(html);
    const text = [title, desc, htmlToText(html)].filter(Boolean).join("\n").slice(0, 60_000);
    const links = usefulLinks(html, res.url || url, 4);
    await savePage(url, text, res.status, links);
    return { url, text, status: res.status, links };
  } catch {
    return null;
  }
}

async function savePage(url: string, text: string, status: number, links: string[]) {
  await q(
    `insert into outreach.pages (url, text, status, links, fetched_at) values ($1, $2, $3, $4, now())
       on conflict (url) do update set text = excluded.text, status = excluded.status, links = excluded.links, fetched_at = now()`,
    [url, text, status, links],
  );
}

/** Homepage plus up to `extra` useful pages from the same site. */
export async function fetchSite(website: string, extra = 2): Promise<Page[]> {
  const home = await fetchPage(website);
  if (!home) return [];
  const more = await Promise.all(home.links.slice(0, extra).map((l) => fetchPage(l)));
  return [home, ...more.filter((p): p is Page => Boolean(p?.text))];
}
