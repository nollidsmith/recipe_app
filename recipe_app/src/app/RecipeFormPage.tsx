import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRecipe } from "../lib/recipes";
import type { Difficulty, RecipeDraft } from "../types/recipe";

const emptyIngredient = { name: "", quantity: null, unit: "", notes: "" };

const initialDraft: RecipeDraft = {
  title: "",
  description: "",
  instructions: "",
  prepMinutes: "",
  cookMinutes: "",
  servings: "",
  difficulty: "easy",
  ingredients: [emptyIngredient],
};

export default function RecipeFormPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<RecipeDraft>(initialDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof RecipeDraft>(field: K, value: RecipeDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateIngredient = (index: number, field: keyof RecipeDraft["ingredients"][number], value: string | number | null) => {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) => ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!draft.title.trim() || !draft.instructions.trim()) {
      setError("Add a recipe title and instructions before saving.");
      return;
    }

    const invalidNumber = [draft.prepMinutes, draft.cookMinutes, draft.servings].some((value) => value.trim() && Number(value) < 0);
    if (invalidNumber) {
      setError("Time and servings values cannot be negative.");
      return;
    }

    setBusy(true);
    try {
      await createRecipe(draft);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this recipe.");
      setBusy(false);
    }
  };

  return (
    <main className="recipe-editor-shell">
      <header className="recipe-editor-header">
        <div><p className="eyebrow">PantryPilot / Recipes</p><h1>Add a recipe</h1><p className="muted">Save the meals you want to remember.</p></div>
        <Link className="button button-secondary" to="/">Back to hub</Link>
      </header>

      <form className="recipe-form" onSubmit={submit}>
        {error && <div className="notice error" role="alert">{error}</div>}
        <section className="form-section">
          <div className="section-heading"><p className="eyebrow">Start here</p><h2>Recipe details</h2></div>
          <div className="form-grid form-grid-wide">
            <label>Recipe title<input value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Weeknight tomato pasta" required /></label>
            <label>Description<textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="What makes this recipe worth saving?" rows={3} /></label>
          </div>
          <div className="form-grid form-grid-three">
            <label>Prep minutes<input type="number" min="0" value={draft.prepMinutes} onChange={(event) => update("prepMinutes", event.target.value)} /></label>
            <label>Cook minutes<input type="number" min="0" value={draft.cookMinutes} onChange={(event) => update("cookMinutes", event.target.value)} /></label>
            <label>Servings<input type="number" min="1" value={draft.servings} onChange={(event) => update("servings", event.target.value)} /></label>
          </div>
          <label>Difficulty<select value={draft.difficulty} onChange={(event) => update("difficulty", event.target.value as Difficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        </section>

        <section className="form-section">
          <div className="section-heading"><p className="eyebrow">Build the list</p><h2>Ingredients</h2></div>
          <div className="ingredient-list">
            {draft.ingredients.map((ingredient, index) => <div className="ingredient-row" key={index}>
              <input aria-label={`Ingredient ${index + 1} name`} value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} placeholder="Ingredient" />
              <input aria-label={`Ingredient ${index + 1} quantity`} type="number" min="0" step="any" value={ingredient.quantity ?? ""} onChange={(event) => updateIngredient(index, "quantity", event.target.value ? Number(event.target.value) : null)} placeholder="Qty" />
              <input aria-label={`Ingredient ${index + 1} unit`} value={ingredient.unit ?? ""} onChange={(event) => updateIngredient(index, "unit", event.target.value)} placeholder="Unit" />
              <input aria-label={`Ingredient ${index + 1} notes`} value={ingredient.notes ?? ""} onChange={(event) => updateIngredient(index, "notes", event.target.value)} placeholder="Notes" />
              <button className="icon-button" type="button" aria-label={`Remove ingredient ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index) }))} disabled={draft.ingredients.length === 1}>×</button>
            </div>)}
          </div>
          <button className="button button-secondary add-ingredient" type="button" onClick={() => update("ingredients", [...draft.ingredients, emptyIngredient])}>+ Add ingredient</button>
        </section>

        <section className="form-section">
          <div className="section-heading"><p className="eyebrow">Make it yours</p><h2>Instructions</h2></div>
          <label>Cooking instructions<textarea value={draft.instructions} onChange={(event) => update("instructions", event.target.value)} placeholder="Write the steps in the order you cook them." rows={9} required /></label>
        </section>

        <div className="form-actions"><Link className="button button-secondary" to="/">Cancel</Link><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save recipe"}</button></div>
      </form>
    </main>
  );
}
