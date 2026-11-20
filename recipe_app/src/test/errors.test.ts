import { describe, expect, it, vi } from "vitest";
import { removeStorageFile, toUserFacingError } from "../lib/errors";

describe("backend error handling", () => {
  it("maps internal permission errors to a safe message", () => {
    expect(toUserFacingError({ code: "42501", message: "new row violates row-level security policy" }, "Fallback").message)
      .toBe("You do not have permission to perform that action.");
  });

  it("preserves actionable application errors", () => {
    expect(toUserFacingError(new Error("Choose a JPEG, PNG, or WebP image."), "Fallback").message)
      .toBe("Choose a JPEG, PNG, or WebP image.");
  });

  it("retries cleanup and succeeds after a transient Storage error", async () => {
    const remove = vi.fn()
      .mockResolvedValueOnce({ error: { message: "temporary failure" } })
      .mockResolvedValueOnce({ error: null });

    await expect(removeStorageFile({ remove }, "user/recipes/1/image.webp", "test cleanup")).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("does not block deletion when the Storage object is already missing", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { status: 404, message: "Object not found" } });

    await expect(removeStorageFile({ remove }, "user/pantry/1/image.webp", "test cleanup", true)).resolves.toBeUndefined();
  });
});
