import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateRecipe } = vi.hoisted(() => ({ mockCreateRecipe: vi.fn() }));
vi.mock("../lib/recipes", () => ({ createRecipe: mockCreateRecipe }));

import RecipeFormPage from "../app/RecipeFormPage";

function renderForm() {
  return render(<MemoryRouter><RecipeFormPage /></MemoryRouter>);
}

describe("RecipeFormPage", () => {
  beforeEach(() => mockCreateRecipe.mockReset());

  it("shows validation when title or instructions are missing", async () => {
    const user = userEvent.setup();
    renderForm();

    fireEvent.submit(screen.getByRole("button", { name: "Save recipe" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("Add a recipe title and instructions");
    expect(mockCreateRecipe).not.toHaveBeenCalled();
  });

  it("adds and removes ingredient rows", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText("Ingredient 1 name")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Add ingredient" }));
    expect(screen.getByLabelText("Ingredient 2 name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove ingredient 2" }));
    expect(screen.queryByLabelText("Ingredient 2 name")).not.toBeInTheDocument();
  });

  it("submits a valid recipe draft", async () => {
    const user = userEvent.setup();
    mockCreateRecipe.mockResolvedValue("recipe-1");
    renderForm();

    await user.type(screen.getByLabelText("Recipe title"), "Tomato pasta");
    await user.type(screen.getByLabelText("Cooking instructions"), "Boil and serve");
    await user.type(screen.getByLabelText("Ingredient 1 name"), "Tomato");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({
      title: "Tomato pasta",
      instructions: "Boil and serve",
      ingredients: [expect.objectContaining({ name: "Tomato" })],
    }));
  });
});
