import { describe, expect, it } from "vitest";
import { nextQuery, safeNext } from "@/lib/auth/next";
import { authMessage, authProblem, messageForCode, signUpOutcome } from "@/lib/auth/messages";

describe("safeNext: where an auth step may send you", () => {
  it("follows paths inside the app and invitations", () => {
    expect(safeNext("/app/people/jojo")).toBe("/app/people/jojo");
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app?x=1")).toBe("/app?x=1");
    expect(safeNext("/invite?t=abc")).toBe("/invite?t=abc");
  });

  it("refuses anything that leaves the site or isn't the app", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/apple", "/login", "/app\n//evil.com", " //evil.com", "javascript:alert(1)"]) {
      expect(safeNext(bad)).toBe("/app");
    }
    expect(safeNext(null)).toBe("/app");
    expect(safeNext("//evil.com", "/app/welcome")).toBe("/app/welcome");
  });

  it("builds a ?next= only when there's somewhere to return to", () => {
    expect(nextQuery("/app/people/jojo")).toBe("?next=%2Fapp%2Fpeople%2Fjojo");
    expect(nextQuery("/app")).toBe("");
    expect(nextQuery("//evil.com")).toBe("");
    expect(nextQuery(null)).toBe("");
  });
});

describe("authProblem / authMessage: Supabase's errors, said plainly", () => {
  it("matches on the code, never shows Supabase's text", () => {
    expect(authProblem({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("invalid_credentials");
    expect(authProblem({ code: "email_not_confirmed" })).toBe("email_not_confirmed");
    expect(authProblem({ code: "over_email_send_rate_limit" })).toBe("email_rate_limit");
    expect(authProblem({ code: "pkce_code_verifier_not_found" })).toBe("link_other_device");
    expect(authProblem({ name: "AuthPKCECodeVerifierMissingError" })).toBe("link_other_device");
    expect(authProblem({ code: "otp_expired" })).toBe("link_expired");
    expect(authProblem({ name: "AuthRetryableFetchError", status: 0 })).toBe("offline");
    expect(authProblem({ status: 429 })).toBe("rate_limit");
    expect(authMessage({ message: "PKCE code verifier not found in storage" })).not.toMatch(/PKCE/);
  });
});

describe("messageForCode: what ?error= may say", () => {
  it("knows the link problems and nothing else", () => {
    expect(messageForCode("link_expired")?.kind).toBe("error");
    expect(messageForCode("link_other_device")?.kind).toBe("notice");
    expect(messageForCode("You have been hacked, call 555-0100")).toBeNull();
    expect(messageForCode("%")).toBeNull();
    expect(messageForCode(null)).toBeNull();
  });
});

describe("signUpOutcome: new, already here, or never confirmed", () => {
  const at = "2026-10-05T10:00:00Z";
  it("a new address: check your email", () => {
    expect(signUpOutcome({ user: { identities: [{}], created_at: at, confirmation_sent_at: "2026-10-05T10:00:01Z" } })).toBe("check_email");
  });
  it("a confirmed account: no email was sent, say so", () => {
    expect(signUpOutcome({ user: { identities: [], created_at: at } })).toBe("already_registered");
    expect(signUpOutcome({ error: { code: "user_already_exists" } })).toBe("already_registered");
  });
  it("an account that never confirmed: the link was sent again", () => {
    expect(signUpOutcome({ user: { identities: [{}], created_at: "2026-08-09T10:00:00Z", confirmation_sent_at: at } })).toBe("resent_unconfirmed");
  });
  it("a session straight away, and failures", () => {
    expect(signUpOutcome({ user: { identities: [{}] }, session: {} })).toBe("signed_in");
    expect(signUpOutcome({ error: { code: "weak_password" } })).toBe("error");
    expect(signUpOutcome({})).toBe("error");
  });
});
