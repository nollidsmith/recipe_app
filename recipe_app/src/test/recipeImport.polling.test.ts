import { describe, expect, it } from "vitest";
import { pollRecipeImport, type RecipeImportRow } from "../lib/recipeImport";

const row = (status: RecipeImportRow["status"], overrides: Partial<RecipeImportRow> = {}): RecipeImportRow => ({
  status,
  draft_json: status === "ready" ? { title: "Soup", description: "", instructions: "Serve", prepMinutes: "", cookMinutes: "", servings: "", difficulty: "easy", ingredients: [] } : null,
  confidence_json: {}, warnings_json: [], error_message: null, source_filename: "recipe.pdf", ...overrides,
});

describe("recipe import polling", () => {
  it("waits through queued and processing states before returning a draft", async () => {
    const states = [row("queued"), row("processing"), row("ready")];
    const result = await pollRecipeImport(async () => states.shift() ?? row("ready"), async () => undefined);
    expect(result.draft.title).toBe("Soup");
  });

  it("surfaces a terminal failure immediately", async () => {
    await expect(pollRecipeImport(async () => row("failed", { error_message: "Unreadable scan" }), async () => undefined)).rejects.toThrow("Unreadable scan");
  });

  it("times out after the bounded polling window", async () => {
    await expect(pollRecipeImport(async () => row("processing"), async () => undefined)).rejects.toThrow("timed out");
  });
});
