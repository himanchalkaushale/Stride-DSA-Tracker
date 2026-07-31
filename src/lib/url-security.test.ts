import assert from "node:assert/strict";
import test from "node:test";
import { safeHttpUrl, safeRedirectPath, safeSupabaseOAuthUrl } from "./url-security.ts";

test("safeHttpUrl only accepts credential-free HTTP(S) links", () => {
  assert.equal(safeHttpUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("https://user:pass@example.com"), null);
  assert.equal(safeHttpUrl("https://example.com/\nheader"), null);
});

test("safeRedirectPath rejects protocol-relative and encoded separator bypasses", () => {
  assert.equal(safeRedirectPath("/plans?view=all"), "/plans?view=all");
  assert.equal(safeRedirectPath("//evil.example"), "/today");
  assert.equal(safeRedirectPath("/\\evil.example"), "/today");
  assert.equal(safeRedirectPath("/%2f%2fevil.example"), "/today");
});

test("safeSupabaseOAuthUrl pins redirects to the configured authorization endpoint", () => {
  const project = "https://project.supabase.co";
  assert.equal(
    safeSupabaseOAuthUrl("https://project.supabase.co/auth/v1/authorize?provider=google", project),
    "https://project.supabase.co/auth/v1/authorize?provider=google",
  );
  assert.equal(safeSupabaseOAuthUrl("https://evil.example/auth/v1/authorize", project), null);
  assert.equal(safeSupabaseOAuthUrl("https://project.supabase.co/other", project), null);
});
