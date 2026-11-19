import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

vi.mock("../lib/supabase", () => ({ supabase: mockSupabase }));

import { createPantryItem, validatePantryImage } from "../lib/pantry";

describe("pantry image handling", () => {
  beforeEach(() => {
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.from.mockReset();
  });

  it("accepts supported image types and rejects unsupported types", () => {
    expect(() => validatePantryImage(new File(["image"], "stock.webp", { type: "image/webp" }))).not.toThrow();
    expect(() => validatePantryImage(new File(["image"], "stock.gif", { type: "image/gif" }))).toThrow("JPEG, PNG, or WebP");
  });

  it("rejects an invalid image before inserting a pantry row", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await expect(createPantryItem({
      name: "Rice",
      quantity: "1",
      unit: "bag",
      category: "Pantry",
      lowStockThreshold: "",
      expiresOn: "",
      image: new File(["image"], "stock.gif", { type: "image/gif" }),
    })).rejects.toThrow("JPEG, PNG, or WebP");

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
