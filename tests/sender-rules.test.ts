import { describe, expect, it } from "vitest";
import { allowedSends, nextGapSeconds, rampCap } from "@/lib/engine/sender/caps";
import { addBusinessDays, inSendWindow, localTime } from "@/lib/engine/sender/window";
import { composeBody, OPT_OUT_LINE } from "@/lib/engine/sender/compose";
import { rawMessage } from "@/lib/engine/gmail/message";
import { unsubToken, verifyUnsubToken } from "@/lib/engine/sender/unsubscribe";

describe("send window (recipient local, Mon-Fri 08:00-11:00)", () => {
  // Tuesday 17 Nov 2026
  it("is open at 09:30 in the recipient's zone on a weekday", () => {
    expect(inSendWindow(new Date("2026-11-17T04:00:00Z"), "Asia/Kolkata")).toBe(true); // 09:30 IST
    expect(inSendWindow(new Date("2026-11-17T14:30:00Z"), "America/New_York")).toBe(true); // 09:30 EST
  });
  it("is closed before 08:00 and from 11:00", () => {
    expect(inSendWindow(new Date("2026-11-17T02:00:00Z"), "Asia/Kolkata")).toBe(false); // 07:30
    expect(inSendWindow(new Date("2026-11-17T05:30:00Z"), "Asia/Kolkata")).toBe(false); // 11:00
  });
  it("uses the recipient's zone, not the server's", () => {
    const at = new Date("2026-11-17T04:00:00Z");
    expect(inSendWindow(at, "Asia/Kolkata")).toBe(true);
    expect(inSendWindow(at, "America/New_York")).toBe(false); // 23:00 Monday there
  });
  it("is closed on weekends, including when it's still Friday in UTC", () => {
    expect(inSendWindow(new Date("2026-11-21T04:00:00Z"), "Asia/Kolkata")).toBe(false); // Sat
    expect(inSendWindow(new Date("2026-11-22T14:30:00Z"), "America/New_York")).toBe(false); // Sun
    expect(localTime(new Date("2026-11-20T22:00:00Z"), "Pacific/Auckland").weekday).toBe(6); // Sat in NZ
    expect(inSendWindow(new Date("2026-11-20T21:00:00Z"), "Pacific/Auckland")).toBe(false);
  });
  it("falls back to UTC for an invalid zone", () => {
    expect(inSendWindow(new Date("2026-11-17T09:00:00Z"), "Not/AZone")).toBe(true);
  });
  it("adds business days, skipping weekends", () => {
    expect(addBusinessDays(new Date("2026-11-19T10:00:00Z"), 3).toISOString()).toBe("2026-11-24T10:00:00.000Z"); // Thu -> Tue
    expect(addBusinessDays(new Date("2026-11-17T10:00:00Z"), 5).toISOString()).toBe("2026-11-24T10:00:00.000Z");
  });
});

describe("caps and pacing", () => {
  it("ramps 10/20/30/40 per week and stays at 40", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    expect(rampCap(start, new Date("2026-11-03T00:00:00Z"))).toBe(10);
    expect(rampCap(start, new Date("2026-11-09T00:00:00Z"))).toBe(20);
    expect(rampCap(start, new Date("2026-11-16T00:00:00Z"))).toBe(30);
    expect(rampCap(start, new Date("2026-12-30T00:00:00Z"))).toBe(40);
  });
  it("allows the smaller of mailbox and remaining domain cap", () => {
    expect(allowedSends({ cap: 40, sentToday: 10, domainCap: 120, domainSentToday: 0 })).toBe(30);
    expect(allowedSends({ cap: 40, sentToday: 10, domainCap: 120, domainSentToday: 115 })).toBe(5);
    expect(allowedSends({ cap: 40, sentToday: 40, domainCap: 120, domainSentToday: 0 })).toBe(0);
    expect(allowedSends({ cap: 500, sentToday: 0, domainCap: 900, domainSentToday: 0 })).toBe(40); // hard maxima
  });
  it("draws the gap from 45..180 seconds", () => {
    expect(nextGapSeconds((min) => min)).toBe(45);
    expect(nextGapSeconds((min, max) => max - 1)).toBe(180);
  });
});

describe("message", () => {
  it("is plain text with List-Unsubscribe headers and threading on follow-ups", () => {
    const raw = rawMessage({ from: "Aanya <a@x.test>", to: "p@y.test", subject: "Re: hello", body: "Hi", messageId: "<1@x.test>", inReplyTo: "<0@x.test>", unsubMailto: "a@x.test?subject=unsubscribe", unsubUrl: "https://u.test/u?t=1" });
    const text = Buffer.from(raw, "base64url").toString();
    expect(text).toMatch(/Content-Type: text\/plain; charset=UTF-8/);
    expect(text).toMatch(/List-Unsubscribe: <mailto:a@x.test\?subject=unsubscribe>, <https:\/\/u.test\/u\?t=1>/);
    expect(text).toMatch(/List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    expect(text).toMatch(/In-Reply-To: <0@x.test>\r\nReferences: <0@x.test>/);
    expect(text).not.toMatch(/<html|<img/i);
  });
  it("always appends the opt-out line and signature in code", () => {
    const body = composeBody({ firstName: "Riya Sharma", body: "Middle.", senderName: "Aanya", stepNo: 1 });
    expect(body.startsWith("Hi Riya,")).toBe(true);
    expect(body.endsWith(OPT_OUT_LINE)).toBe(true);
    expect(body).toMatch(/Aanya\n/);
  });
  it("signs unsubscribe tokens so nobody can unsubscribe someone else", () => {
    expect(verifyUnsubToken(unsubToken("42"))).toBe("42");
    expect(verifyUnsubToken(unsubToken("42").replace(/^42/, "43"))).toBeNull();
    expect(verifyUnsubToken("42.forged")).toBeNull();
  });
});
