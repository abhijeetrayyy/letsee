import { describe, expect, it } from "vitest";
import { askState, cleanQuestion, MAX_QUESTION, QUESTIONS } from "@/lib/people/asks";

const now = Date.UTC(2026, 9, 3, 12);
const inHours = (h: number) => new Date(now + h * 36e5).toISOString();

describe("an ask", () => {
  it("is open, saying how many answered and for how long", () => {
    expect(askState({ closesAt: inHours(72), closedAt: null, answers: 0 }, now)).toEqual({ open: true, line: "No answers yet · open 3 more days" });
    expect(askState({ closesAt: inHours(5), closedAt: null, answers: 1 }, now)).toEqual({ open: true, line: "1 answer · open 5 more hours" });
    expect(askState({ closesAt: inHours(0.5), closedAt: null, answers: 2 }, now).line).toBe("2 answers · open one more hour");
  });

  it("closes when you close it or its time is up", () => {
    expect(askState({ closesAt: inHours(48), closedAt: inHours(-1), answers: 3 }, now)).toEqual({ open: false, line: "Closed · 3 answers" });
    expect(askState({ closesAt: inHours(-1), closedAt: null, answers: 0 }, now)).toEqual({ open: false, line: "Closed · no answers yet" });
  });

  it("keeps a question to one line of 200 characters", () => {
    expect(cleanQuestion("  Something\n  short ")).toBe("Something short ");
    expect(cleanQuestion("x".repeat(300))).toHaveLength(MAX_QUESTION);
  });

  it("offers starting questions that fit", () => {
    for (const q of QUESTIONS) expect(q.length).toBeLessThanOrEqual(MAX_QUESTION);
  });
});
