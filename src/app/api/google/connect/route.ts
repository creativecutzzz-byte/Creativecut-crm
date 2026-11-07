import { getViewer } from "@/lib/data";
import { consentUrl, makeState, oauthClientReady } from "@/lib/integrations/google-oauth";
import { siteUrl } from "@/lib/site-url";
import { NextResponse } from "next/server";

// Starts "Connect Google": owners/admins only.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.userId || !["owner", "admin"].includes(viewer.role)) return new NextResponse("Only workspace owners and admins can connect Google.", { status: 403 });
  if (!oauthClientReady()) return new NextResponse("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel first (docs/google-gmail-setup.md).", { status: 400 });
  return NextResponse.redirect(consentUrl(await siteUrl(), makeState(viewer.userId)));
}
