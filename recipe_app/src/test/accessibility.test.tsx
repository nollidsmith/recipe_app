import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/recipes", () => ({
  createRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  uploadRecipeImage: vi.fn(),
  validateRecipeImage: vi.fn(),
}));
vi.mock("../lib/recipeImport", async () => {
  const actual = await vi.importActual<typeof import("../lib/recipeImport")>("../lib/recipeImport");
  return { ...actual, importRecipeFile: vi.fn() };
});

import RecipeFormPage from "../app/RecipeFormPage";

describe("recipe editor accessibility smoke checks", () => {
  it("gives every interactive control an accessible name and avoids positive tabindex", () => {
    render(<MemoryRouter><RecipeFormPage /></MemoryRouter>);

    for (const element of screen.getAllByRole("button")) expect(element).toHaveAccessibleName();
    for (const element of screen.getAllByRole("link")) expect(element).toHaveAccessibleName();
    for (const element of screen.getAllByRole("textbox")) expect(element).toHaveAccessibleName();
    for (const element of screen.getAllByRole("combobox")) expect(element).toHaveAccessibleName();
    for (const element of screen.getAllByRole("button").concat(screen.getAllByRole("link"))) {
      expect(Number(element.getAttribute("tabindex") ?? "0")).toBeLessThanOrEqual(0);
    }
  });
});
