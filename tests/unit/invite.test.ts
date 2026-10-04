import { describe, expect, it } from "vitest";
import { cleanInviter, cleanToken, inviteUrl, passLinkUrl } from "@/lib/people/invite";

describe("an invite link", () => {
  it("carries a username and nothing else", () => {
    expect(cleanInviter("ray")).toBe("ray");
    expect(cleanInviter("@ray")).toBe("ray");
    expect(cleanInviter(" priya_k ")).toBe("priya_k");
    expect(cleanInviter("ray/../../admin")).toBeNull();
    expect(cleanInviter("<script>")).toBeNull();
    expect(cleanInviter("")).toBeNull();
    expect(cleanInviter(null)).toBeNull();
  });

  it("is built on the static invite page", () => {
    expect(inviteUrl("ray", "https://letsee.online")).toBe("https://letsee.online/invite?from=ray");
  });
});

describe("a pass link", () => {
  const token = "0123456789abcdef0123456789abcdef";
  it("accepts only a 32-character hex token", () => {
    expect(cleanToken(token)).toBe(token);
    expect(cleanToken(token.toUpperCase())).toBe(token);
    expect(cleanToken(" " + token + " ")).toBe(token);
    expect(cleanToken(token.slice(1))).toBeNull();
    expect(cleanToken("../../etc/passwd")).toBeNull();
    expect(cleanToken("0123456789abcdef0123456789abcdeg")).toBeNull();
    expect(cleanToken(null)).toBeNull();
  });

  it("opens on the invited door", () => {
    expect(passLinkUrl(token, "https://letsee.app")).toBe(`https://letsee.app/invite?t=${token}`);
  });
});
