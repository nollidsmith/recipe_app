import { describe, expect, it } from "vitest";
import { MAX_RECIPE_IMPORT_BYTES, validateRecipeImport } from "../lib/recipeImport";

describe("recipe import validation", () => {
  it("accepts supported PDF and image files under the limit", () => {
    expect(() => validateRecipeImport(new File(["recipe"], "recipe.pdf", { type: "application/pdf" }))).not.toThrow();
    expect(() => validateRecipeImport(new File(["recipe"], "recipe.jpg", { type: "image/jpeg" }))).not.toThrow();
  });

  it("rejects unsupported types and oversized sources", () => {
    expect(() => validateRecipeImport(new File(["recipe"], "recipe.txt", { type: "text/plain" }))).toThrow("Choose a PDF");
    const oversized = new File([new Uint8Array(MAX_RECIPE_IMPORT_BYTES + 1)], "recipe.pdf", { type: "application/pdf" });
    expect(() => validateRecipeImport(oversized)).toThrow("10 MB");
  });
});
