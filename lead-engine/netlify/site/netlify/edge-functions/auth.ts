// Basic-Auth gate for the internal status page.
// Set STATUS_USER and STATUS_PASSWORD in Netlify → Site configuration → Environment variables.
// If either is missing, every request is refused (safe default).
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const user = Netlify.env.get("STATUS_USER");
  const pass = Netlify.env.get("STATUS_PASSWORD");
  const deny = () =>
    new Response("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Creative Cut internal", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  if (!user || !pass) return deny();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return deny();
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return deny();
  }
  const i = decoded.indexOf(":");
  if (i < 0 || decoded.slice(0, i) !== user || decoded.slice(i + 1) !== pass) return deny();
  const res = await context.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
};

export const config = { path: "/*" };
