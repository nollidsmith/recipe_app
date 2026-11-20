import { beforeEach, describe, expect, it } from "vitest";
import { clearOAuthCallbackParams, consumeOAuthReturnTo, getOAuthCallbackParams, isOAuthCallbackUrl, rememberOAuthReturnTo, safeInternalPath } from "../app/oauth";

describe("OAuth callback helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("rejects external return paths", () => {
    expect(safeInternalPath("https://example.com")).toBe("/");
    expect(safeInternalPath("//example.com")).toBe("/");
    expect(safeInternalPath("/recipes/new")).toBe("/recipes/new");
  });

  it("remembers and consumes an internal return path once", () => {
    rememberOAuthReturnTo("/pantry?low=true");
    expect(consumeOAuthReturnTo()).toBe("/pantry?low=true");
    expect(consumeOAuthReturnTo()).toBe("/");
  });

  it("reads provider errors from the query string", () => {
    window.history.replaceState({}, "", "/?error=access_denied&error_description=User%20cancelled&error_code=provider_error");
    expect(getOAuthCallbackParams()).toMatchObject({
      isCallback: true,
      error: "access_denied",
      errorDescription: "User cancelled",
      errorCode: "provider_error",
    });
  });

  it("reads callback values from the hash and clears callback params without losing unrelated query data", () => {
    window.history.replaceState({}, "", "/?next=%2Fpantry#access_token=token&refresh_token=refresh");
    expect(getOAuthCallbackParams().isCallback).toBe(true);
    clearOAuthCallbackParams();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/?next=%2Fpantry");
  });

  it("does not treat Supabase password recovery hashes as OAuth callbacks", () => {
    window.history.replaceState({}, "", "/reset-password#access_token=token&refresh_token=refresh&type=recovery");
    expect(getOAuthCallbackParams().isCallback).toBe(true);
    expect(isOAuthCallbackUrl()).toBe(false);
  });

  it("keeps password reset code callbacks on the recovery route even without a recovery type", () => {
    window.history.replaceState({}, "", "/reset-password?code=recovery-code");
    expect(isOAuthCallbackUrl()).toBe(false);
  });

  it("continues to classify normal OAuth callbacks outside the recovery route", () => {
    window.history.replaceState({}, "", "/?code=oauth-code");
    expect(isOAuthCallbackUrl()).toBe(true);
    window.history.replaceState({}, "", "/?error=access_denied");
    expect(isOAuthCallbackUrl()).toBe(true);
  });
});
