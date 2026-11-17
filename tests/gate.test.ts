import { describe, expect, it } from "vitest";
import { hygieneProblems, norm, pageWithQuote, quotePasses } from "@/lib/engine/research/gate";

const page = `Acme Robotics
We help mid-sized warehouses cut picking errors with vision-guided robot arms.
Last year we opened our second factory in Pune and hired 40 engineers.`;

const goodBody =
  "Saw that you opened a second factory in Pune last year and hired a big engineering team. " +
  "Growing teams usually need a steady stream of hiring and product videos, and most in-house marketers " +
  "don't have the editing hours for it. We edit short-form product and culture videos for B2B companies, " +
  "with a two-day turnaround and a fixed monthly price. Would it help if I sent two examples from a robotics brand we work with?";

describe("quality gate: quote check", () => {
  it("REJECTS a fabricated quote that is not on the page", () => {
    expect(quotePasses("We were named the fastest growing robotics company in India", page)).toBe(false);
  });

  it("rejects a subtly paraphrased quote", () => {
    expect(quotePasses("Last year we opened our third factory in Pune", page)).toBe(false);
  });

  it("passes a verbatim quote despite curly quotes, case and line breaks", () => {
    expect(quotePasses("last year we opened our second\nfactory in Pune — and hired 40 engineers", page)).toBe(true);
    expect(quotePasses("We help mid‑sized warehouses cut picking errors", page)).toBe(true); // non-breaking hyphen
    expect(quotePasses("We help “mid-sized” warehouses cut picking errors", page)).toBe(true);
  });

  it("requires at least six words so a one-word quote can't pass trivially", () => {
    expect(quotePasses("Pune", page)).toBe(false);
    expect(quotePasses("opened our second factory in", page)).toBe(false);
  });

  it("lets a generic email (no quote) through", () => {
    expect(quotePasses(null, page)).toBe(true);
  });

  it("finds the page holding the quote, preferring the one the model named", () => {
    const pages = [
      { url: "https://a.test", text: "nothing here" },
      { url: "https://a.test/about", text: page },
    ];
    expect(pageWithQuote("Last year we opened our second factory in Pune", pages, "https://a.test")?.url).toBe("https://a.test/about");
    expect(pageWithQuote("We were named the fastest growing robotics company", pages)).toBeNull();
  });

  it("normalises punctuation and whitespace", () => {
    expect(norm("  Hello,\n  WORLD!! it’s  ")).toBe("hello world it s");
  });
});

describe("quality gate: hygiene check", () => {
  const ok = { subject: "videos for the Pune team", body: goodBody, followups: ["Quick nudge on this. Happy to send two short examples if useful.", "Last note from me. If video isn't a priority this quarter, no worries at all."] };

  it("passes a clean draft", () => {
    expect(hygieneProblems(ok)).toEqual([]);
  });

  it("flags links and web addresses", () => {
    expect(hygieneProblems({ ...ok, body: goodBody + " See https://x.com" }).join()).toMatch(/link/);
    expect(hygieneProblems({ ...ok, followups: ["Examples at creativecut.in if you want to look.", ok.followups[1]!] }).join()).toMatch(/link/);
  });

  it("flags leftover placeholders", () => {
    expect(hygieneProblems({ ...ok, body: goodBody.replace("Saw", "Hi {first_name}, saw") }).join()).toMatch(/placeholder/);
  });

  it("enforces body word count and subject length", () => {
    expect(hygieneProblems({ ...ok, body: "Too short." }).join()).toMatch(/body is 2 words/);
    expect(hygieneProblems({ ...ok, subject: "one two three four five six seven eight nine" }).join()).toMatch(/subject is 9 words/);
  });

  it("flags fake Re: subjects and all-caps shouting, but allows short acronyms", () => {
    expect(hygieneProblems({ ...ok, subject: "Re: quick question" }).join()).toMatch(/Re:/);
    expect(hygieneProblems({ ...ok, subject: "URGENT videos" }).join()).toMatch(/all-caps/);
    expect(hygieneProblems({ ...ok, subject: "videos for your CEO" })).toEqual([]);
  });
});
