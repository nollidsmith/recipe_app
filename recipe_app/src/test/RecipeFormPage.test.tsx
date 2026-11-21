import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateRecipe, mockImportRecipeFile } = vi.hoisted(() => ({ mockCreateRecipe: vi.fn(), mockImportRecipeFile: vi.fn() }));
vi.mock("../lib/recipes", () => ({ createRecipe: mockCreateRecipe }));
vi.mock("../lib/recipeImport", async () => {
  const actual = await vi.importActual<typeof import("../lib/recipeImport")>("../lib/recipeImport");
  return { ...actual, importRecipeFile: mockImportRecipeFile };
});

import RecipeFormPage from "../app/RecipeFormPage";

function renderForm() {
  return render(<MemoryRouter><RecipeFormPage /></MemoryRouter>);
}

describe("RecipeFormPage", () => {
  beforeEach(() => { mockCreateRecipe.mockReset(); mockImportRecipeFile.mockReset(); });

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

  it("loads an imported recipe as a draft without saving it automatically", async () => {
    const user = userEvent.setup();
    mockImportRecipeFile.mockResolvedValue({
      sourceName: "card.jpg",
      warnings: ["Check the cooking temperature."],
      confidence: {},
      draft: {
        title: "Imported soup",
        description: "A draft",
        instructions: "Simmer and serve",
        prepMinutes: "10",
        cookMinutes: "20",
        servings: "4",
        difficulty: "easy",
        ingredients: [{ name: "Carrot", quantity: 2, unit: "", notes: "" }],
      },
    });
    renderForm();

    const file = new File(["recipe"], "card.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Choose a PDF or paper recipe"), file);

    expect(await screen.findByDisplayValue("Imported soup")).toBeInTheDocument();
    expect(screen.getByText(/Check the cooking temperature/)).toBeInTheDocument();
    expect(mockCreateRecipe).not.toHaveBeenCalled();

    mockCreateRecipe.mockResolvedValue("recipe-1");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({ title: "Imported soup" }));
  });

  it("discloses Gemini processing before an import is selected", () => {
    renderForm();
    expect(screen.getByText(/sent to Google Gemini for extraction/i)).toBeInTheDocument();
  });

  it("shows user-facing confidence labels in the import review warning", async () => {
    const user = userEvent.setup();
    mockImportRecipeFile.mockResolvedValue({
      sourceName: "card.jpg",
      warnings: [],
      confidence: { prepMinutes: 0.4, cookMinutes: 0.5, ingredients: 0.6 },
      draft: {
        title: "Imported soup",
        description: "",
        instructions: "Simmer and serve",
        prepMinutes: "10",
        cookMinutes: "20",
        servings: "4",
        difficulty: "easy",
        ingredients: [{ name: "Carrot", quantity: null, unit: "", notes: "" }],
      },
    });
    renderForm();

    await user.upload(screen.getByLabelText("Choose a PDF or paper recipe"), new File(["recipe"], "card.jpg", { type: "image/jpeg" }));

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent("prep time, cook time, ingredients");
    expect(warning).not.toHaveTextContent("prepMinutes");
  });

  it("offers retry and reselect actions after an import fails", async () => {
    const user = userEvent.setup();
    mockImportRecipeFile.mockRejectedValue(new Error("Recipe reading timed out. Use Retry import or choose the file again."));
    renderForm();

    await user.upload(screen.getByLabelText("Choose a PDF or paper recipe"), new File(["recipe"], "card.jpg", { type: "image/jpeg" }));

    expect(await screen.findByRole("button", { name: "Retry import" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a different file" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Use Retry import or choose the file again");

    mockImportRecipeFile.mockResolvedValueOnce({
      sourceName: "card.jpg",
      warnings: [],
      confidence: {},
      draft: {
        title: "Recovered recipe",
        description: "",
        instructions: "Serve",
        prepMinutes: "",
        cookMinutes: "",
        servings: "",
        difficulty: "easy",
        ingredients: [],
      },
    });
    await user.click(screen.getByRole("button", { name: "Retry import" }));
    expect(await screen.findByDisplayValue("Recovered recipe")).toBeInTheDocument();
    expect(mockImportRecipeFile).toHaveBeenCalledTimes(2);
  });

  it("does not offer retry for a file that fails client validation", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText("Choose a PDF or paper recipe"), new File([new Uint8Array(10 * 1024 * 1024 + 1)], "notes.pdf", { type: "application/pdf" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("10 MB");
    expect(screen.queryByRole("button", { name: "Retry import" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a different file" })).toBeInTheDocument();
  });
});
