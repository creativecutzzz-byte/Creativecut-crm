import { NextResponse, type NextRequest } from "next/server";
import { canChangeLive } from "@/lib/agent/access";
import { agentEnv, cloudConfigured } from "@/lib/agent/google-cloud";
import { currentSource } from "@/lib/agent/store";
import { siteUrl } from "@/lib/site-url";
import { GMAIL_SCOPES, signState, stateSecret } from "@/lib/agent/gmail-state";

// "Connect with Google" for a Gmail sender slot (1–3).
export async function GET(req: NextRequest) {
  const slot = Number(req.nextUrl.searchParams.get("slot"));
  const back = new URL("/agent/settings?open=gmail", req.url);
  if (![1, 2, 3].includes(slot)) return NextResponse.redirect(back);
  if ((await currentSource()).backend === "demo") {
    back.searchParams.set("notice", "Demo data is on — Google sign-in only runs on live data.");
    return NextResponse.redirect(back);
  }
  const access = await canChangeLive();
  if (!access.ok) return new NextResponse(access.reason, { status: 403 });
  if (!agentEnv.gmailClientId || !agentEnv.gmailClientSecret || !stateSecret() || !cloudConfigured()) {
    back.searchParams.set("notice", "Google sign-in isn't set up for this app yet (see lead-engine/README.md → Connections).");
    return NextResponse.redirect(back);
  }
  const ts = Date.now();
  const params = new URLSearchParams({
    client_id: agentEnv.gmailClientId,
    redirect_uri: `${(await siteUrl()).replace(/\/$/, "")}/api/agent/gmail/callback`,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state: `${slot}.${ts}.${signState(slot, ts)}`,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
