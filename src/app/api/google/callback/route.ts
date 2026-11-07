import { getViewer } from "@/lib/data";
import { checkState, exchangeCode } from "@/lib/integrations/google-oauth";
import { siteUrl } from "@/lib/site-url";
import { NextResponse, type NextRequest } from "next/server";

// Google sends the owner back here after consent. The refresh token is shown
// once, to the signed-in owner only, to paste into Vercel's environment
// variables. It is never stored in the database or logged.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  const params = request.nextUrl.searchParams;
  if (!viewer.userId || !["owner", "admin"].includes(viewer.role)) return page("Sign in as the workspace owner first.", null);
  if (params.get("error")) return page(`Google said: ${escapeHtml(params.get("error") ?? "")}. Try again from Settings.`, null);
  if (!checkState(params.get("state"), viewer.userId)) return page("This link expired. Start again from Settings → Connect Google.", null);

  try {
    const result = await exchangeCode(await siteUrl(), params.get("code") ?? "");
    if (!result.refreshToken) return page("Google didn't return a refresh token. Remove the CRM's access at myaccount.google.com/permissions, then connect again.", null);
    return page("Google connected. One last step:", result);
  } catch (err) {
    return page(`Couldn't finish connecting: ${escapeHtml(err instanceof Error ? err.message : "error")}`, null);
  }
}

function page(message: string, result: { refreshToken: string | null; email: string; scopes: string } | null) {
  const body = result
    ? `<p>Open <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel</a> → your CRM project → Settings → Environment Variables, and add these two (type <b>Sensitive</b>, environment <b>Production</b>), then redeploy:</p>
<label>Key</label><code>GOOGLE_OAUTH_EMAIL</code>
<label>Value</label><textarea readonly rows="1">${escapeHtml(result.email)}</textarea>
<label>Key</label><code>GOOGLE_OAUTH_REFRESH_TOKEN</code>
<label>Value</label><textarea readonly rows="3">${escapeHtml(result.refreshToken ?? "")}</textarea>
<p class="muted">Keep this page private and close it after copying. Don't paste the token into chats or email. Granted: ${escapeHtml(result.scopes)}</p>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Connect Google</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0b10;color:#e7e7ee;margin:0;padding:24px 16px}main{max-width:560px;margin:0 auto}
a{color:#a99cff}code{display:block;background:#17171f;border:1px solid #2a2a35;border-radius:8px;padding:8px 10px;margin:4px 0 10px}
textarea{width:100%;box-sizing:border-box;background:#17171f;color:#e7e7ee;border:1px solid #2a2a35;border-radius:8px;padding:8px 10px;margin:4px 0 12px;font-family:ui-monospace,monospace;font-size:12px}
label{font-size:12px;color:#9a9aa8}.muted{color:#9a9aa8;font-size:12px}</style></head>
<body><main><h1 style="font-size:18px">${message}</h1>${body}<p><a href="/settings">← Back to Settings</a></p></main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
