import { describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

vi.mock("../lib/supabase", () => ({ supabase: mockSupabase }));

import { createRecipe, listRecipes, validateRecipeImage } from "../lib/recipes";

describe("recipe data access", () => {
  it("lists recipes and normalizes missing ingredients", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: "recipe-1", title: "Pasta", recipe_ingredients: null }],
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ order }),
    });

    await expect(listRecipes()).resolves.toEqual([
      { id: "recipe-1", title: "Pasta", recipe_ingredients: [], image_url: null },
    ]);
    expect(mockSupabase.from).toHaveBeenCalledWith("recipes");
  });

  it("creates a recipe and its non-empty ingredients for the signed-in user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const ingredientInsert = vi.fn().mockResolvedValue({ error: null });
    const recipeInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "recipe-1" }, error: null }),
      }),
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "recipes") return { insert: recipeInsert };
      return { insert: ingredientInsert };
    });

    await expect(createRecipe({
      title: "  Pasta ",
      description: "",
      instructions: "Boil and serve",
      prepMinutes: "10",
      cookMinutes: "20",
      servings: "2",
      difficulty: "easy",
      ingredients: [
        { name: "Tomato", quantity: 2, unit: "cups", notes: "ripe" },
        { name: "   ", quantity: null, unit: "", notes: "" },
      ],
    })).resolves.toBe("recipe-1");

    expect(recipeInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      title: "Pasta",
      description: null,
      prep_minutes: 10,
      cook_minutes: 20,
      servings: 2,
    }));
    expect(ingredientInsert).toHaveBeenCalledWith([
      expect.objectContaining({ recipe_id: "recipe-1", name: "Tomato", position: 0 }),
    ]);
  });

  it("validates supported recipe image types and size", () => {
    expect(() => validateRecipeImage(new File(["image"], "recipe.webp", { type: "image/webp" }))).not.toThrow();
    expect(() => validateRecipeImage(new File(["text"], "recipe.gif", { type: "image/gif" }))).toThrow("JPEG, PNG, or WebP");
  });
});
