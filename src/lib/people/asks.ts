/**
 * Ask your people (migration 110): the starting questions and how an ask is
 * doing, in one line. Plain functions, tested (tests/unit/asks.test.ts).
 */
export const QUESTIONS = [
  "Something short and funny for tonight?",
  "A film I can watch with my parents?",
  "Something you love that I haven't seen?",
  "A series to start this weekend?",
  "Something that'll make me cry, in a good way?",
];

export const MAX_QUESTION = 200;

export function cleanQuestion(text: string): string {
  return text.replace(/\s+/g, " ").trimStart().slice(0, MAX_QUESTION);
}

export function askState(ask: { closesAt: string; closedAt: string | null; answers: number }, now = Date.now()): { open: boolean; line: string } {
  const answers = ask.answers === 0 ? "No answers yet" : ask.answers === 1 ? "1 answer" : `${ask.answers} answers`;
  if (ask.closedAt) return { open: false, line: `Closed · ${answers.toLowerCase()}` };
  const left = new Date(ask.closesAt).getTime() - now;
  if (left <= 0) return { open: false, line: `Closed · ${answers.toLowerCase()}` };
  const hours = Math.ceil(left / 36e5);
  return { open: true, line: `${answers} · open ${hours > 24 ? `${Math.ceil(hours / 24)} more days` : hours === 1 ? "one more hour" : `${hours} more hours`}` };
}
