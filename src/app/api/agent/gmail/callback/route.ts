import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { canChangeLive } from "@/lib/agent/access";
import { agentEnv, putSecret, setSettings } from "@/lib/agent/google-cloud";
import { siteUrl } from "@/lib/site-url";
import { signState } from "@/lib/agent/gmail-state";

// Finishes Google sign-in for a sender slot: the refresh token goes straight to
// Secret Manager (GMAIL_SENDER_<slot>_REFRESH_TOKEN); only the address is shown.
export async function GET(req: NextRequest) {
  const back = new URL("/agent/settings?open=gmail", req.url);
  const say = (m: string) => {
    back.searchParams.set("notice", m);
    return NextResponse.redirect(back);
  };
  const access = await canChangeLive();
  if (!access.ok) return new NextResponse(access.reason, { status: 403 });
  const [slotS, tsS, sig] = (req.nextUrl.searchParams.get("state") ?? "").split(".");
  const slot = Number(slotS);
  const ts = Number(tsS);
  const expected = signState(slot, ts);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) || Date.now() - ts > 15 * 60_000 || ![1, 2, 3].includes(slot)) {
    return say("That sign-in link expired. Please try again.");
  }
  if (req.nextUrl.searchParams.get("error")) return say("Google sign-in was cancelled. Nothing was changed.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: req.nextUrl.searchParams.get("code") ?? "",
      client_id: agentEnv.gmailClientId,
      client_secret: agentEnv.gmailClientSecret,
      redirect_uri: `${(await siteUrl()).replace(/\/$/, "")}/api/agent/gmail/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; scope?: string };
  if (!res.ok || !j.refresh_token) return say("Google didn't return access for sending. Please try again and allow both permissions.");
  if (!(j.scope ?? "").includes("gmail.send") || !(j.scope ?? "").includes("gmail.metadata")) return say("Both permissions are needed: sending email, and reading headers to spot replies.");
  let email = "";
  try {
    email = (JSON.parse(Buffer.from((j.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string }).email ?? "";
  } catch {
    email = "";
  }
  if (!email) return say("Couldn't read the Gmail address from Google. Please try again.");
  try {
    await putSecret(`GMAIL_SENDER_${slot}_REFRESH_TOKEN`, j.refresh_token);
    await setSettings({ [`SENDER_${slot}_EMAIL`]: email, [`SENDER_${slot}_STATUS`]: "connected", ...(slot === 1 ? { SENDER_EMAIL: email } : {}) });
  } catch (e) {
    return say(e instanceof Error ? e.message : "Couldn't save the connection.");
  }
  back.searchParams.set("notice", `Connected ${email} as sender ${slot}.`);
  return NextResponse.redirect(back);
}
