import { describe, expect, it } from "vitest";
import { IcpSchema } from "@/lib/engine/config";
import { normaliseRow, ruleCheck } from "@/lib/engine/intake/normalize";
import { leadTimeZone } from "@/lib/engine/intake/countries";
import { bouncedAddress, isAutoReply, isBounce, isHardBounce, isOptOut, stripQuoted } from "@/lib/engine/replies/detect";
import { isAllowedByRobots } from "@/lib/engine/research/robots";
import { isPrivateIp } from "@/lib/engine/research/fetch";
import { verdict } from "@/lib/engine/intake/verify";

const icp = IcpSchema.parse({ allowed_countries: ["IN", "US"], target_titles: ["Founder", "Head of Marketing"], employee_range: [10, 200], industries: [], exclude: [] });
const row = { email: " Riya@Acme.test ", first_name: "Riya", company: "Acme", website: "acme.test", country: "India", title: "Co-Founder & CEO" };

describe("intake normalisation", () => {
  it("lowercases, trims, derives website, country code and time zone", () => {
    const lead = normaliseRow(row, icp);
    expect(lead).toMatchObject({ email: "riya@acme.test", website: "https://acme.test", country: "IN", timezone: "Asia/Kolkata" });
  });
  it("rejects role addresses, free mail, missing fields and countries off the allow-list", () => {
    expect(normaliseRow({ ...row, email: "info@acme.test" }, icp)).toEqual({ rejected: "role_address" });
    expect(normaliseRow({ ...row, email: "riya@gmail.com" }, icp)).toEqual({ rejected: "free_mail" });
    expect(normaliseRow({ ...row, company: "" }, icp)).toEqual({ rejected: "missing_fields" });
    expect(normaliseRow({ ...row, country: "Germany" }, icp)).toEqual({ rejected: "country" });
    expect(normaliseRow({ ...row, country: "" }, icp)).toEqual({ rejected: "country" });
  });
  it("applies the ICP rule layer (title, country, size)", () => {
    expect(ruleCheck({ title: "Co-Founder & CEO", country: "IN", employees: 50 }, icp)).toEqual({ ok: true });
    expect(ruleCheck({ title: "Intern", country: "IN", employees: 50 }, icp).ok).toBe(false);
    expect(ruleCheck({ title: "Founder", country: "IN", employees: 5000 }, icp).ok).toBe(false);
    expect(ruleCheck({ title: "Head of Growth Marketing", country: "US", employees: null }, icp).ok).toBe(true);
    expect(ruleCheck({ title: "Sales Manager", country: "US", employees: null }, icp).ok).toBe(false);
  });
  it("prefers an explicit valid time zone", () => {
    expect(leadTimeZone("America/Chicago", "US")).toBe("America/Chicago");
    expect(leadTimeZone("bogus", "US")).toBe("America/New_York");
  });
  it("only lets valid (and optionally catch-all) addresses through verification", () => {
    expect(verdict("valid", false).status).toBe("verified");
    expect(verdict("catch_all", false).status).toBe("disqualified");
    expect(verdict("catch_all", true)).toEqual({ status: "verified", segment: "low_priority_catch_all" });
    expect(verdict("unknown", true).status).toBe("disqualified");
  });
});

describe("reply detection", () => {
  it("detects auto-replies by header and subject", () => {
    expect(isAutoReply({ "auto-submitted": "auto-replied" })).toBe(true);
    expect(isAutoReply({ "auto-submitted": "no" })).toBe(false);
    expect(isAutoReply({ precedence: "bulk" })).toBe(true);
    expect(isAutoReply({}, "Out of Office: back Monday")).toBe(true);
    expect(isAutoReply({}, "Re: videos for the Pune team")).toBe(false);
  });
  it("detects bounces and parses the failed address", () => {
    expect(isBounce("Mail Delivery Subsystem <mailer-daemon@googlemail.com>", {})).toBe(true);
    expect(bouncedAddress("Final-Recipient: rfc822; gone@acme.test\nStatus: 5.1.1")).toBe("gone@acme.test");
    expect(bouncedAddress("Your message wasn't delivered to gone@acme.test because the address couldn't be found")).toBe("gone@acme.test");
    expect(isHardBounce("Status: 5.1.1 The email account does not exist")).toBe(true);
    expect(isHardBounce("Status: 4.2.2 The recipient's mailbox is full, try again later")).toBe(false);
  });
  it("catches opt-outs without a model call, but not ordinary uses of 'stop'", () => {
    expect(isOptOut("Please remove me from your list")).toBe(true);
    expect(isOptOut("no")).toBe(true);
    expect(isOptOut("Stop emailing me")).toBe(true);
    expect(isOptOut("We can't stop growing — let's talk next week")).toBe(false);
  });
  it("strips the quoted thread", () => {
    expect(stripQuoted("Sounds good, call Thursday?\n\nOn Tue, 17 Nov 2026 at 09:30, Aanya <a@x.test> wrote:\n> Hi Riya")).toBe("Sounds good, call Thursday?");
  });
});

describe("fetch safety", () => {
  it("honours robots.txt", () => {
    const robots = "User-agent: *\nDisallow: /private\nAllow: /private/ok\n";
    expect(isAllowedByRobots(robots, "/about")).toBe(true);
    expect(isAllowedByRobots(robots, "/private/x")).toBe(false);
    expect(isAllowedByRobots(robots, "/private/ok")).toBe(true);
    expect(isAllowedByRobots("User-agent: *\nDisallow: /", "/")).toBe(false);
  });
  it("blocks private and loopback targets", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.2.3.4")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
  });
});
