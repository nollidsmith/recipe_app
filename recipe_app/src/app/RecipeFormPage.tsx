import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRecipe, deleteRecipe, uploadRecipeImage, validateRecipeImage } from "../lib/recipes";
import { importRecipeFile, validateRecipeImport } from "../lib/recipeImport";
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

const confidenceLabels: Record<string, string> = {
  title: "title",
  description: "description",
  instructions: "instructions",
  prepMinutes: "prep time",
  cookMinutes: "cook time",
  servings: "servings",
  difficulty: "difficulty",
  ingredients: "ingredients",
};

function formatConfidenceField(field: string) {
  return confidenceLabels[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

export default function RecipeFormPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<RecipeDraft>(initialDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importWarning, setImportWarning] = useState("");
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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
    let recipeId = "";
    try {
      recipeId = await createRecipe(draft);
      if (imageFile) await uploadRecipeImage(recipeId, imageFile);
      navigate("/", { replace: true });
    } catch (caught) {
      if (recipeId) await deleteRecipe(recipeId).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : "Unable to save this recipe.");
      setBusy(false);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setImportWarning("");
    setRetryFile(null);
    let canRetry = false;
    try {
      validateRecipeImport(file);
      setRetryFile(file);
      canRetry = true;
      setImporting(true);
      setImportStatus("Uploading source…");
      const result = await importRecipeFile(file);
      const hasDraftContent = draft.title.trim() || draft.instructions.trim() || draft.ingredients.some((ingredient) => ingredient.name.trim());
      if (hasDraftContent && !window.confirm("Replace the current draft with the imported recipe?")) {
        setImportStatus("Import discarded. Choose another file or continue editing.");
        return;
      }
      setDraft(result.draft);
      const lowConfidence = Object.entries(result.confidence).filter(([, score]) => score < 0.7).map(([field]) => field);
      const confidenceText = lowConfidence.length > 0 ? ` Review these fields closely: ${lowConfidence.map(formatConfidenceField).join(", ")}.` : "";
      const warningText = result.warnings.length > 0 ? ` ${result.warnings.join(" ")}` : "";
      setImportWarning(`AI-generated draft — verify ingredients, quantities, temperatures, and timings before saving.${warningText}`);
      if (confidenceText) setImportWarning((current) => `${current}${confidenceText}`);
      setImportStatus(`Draft prepared from ${result.sourceName}.`);
      setRetryFile(null);
      if (importInputRef.current) importInputRef.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to read that recipe.");
      setImportStatus(canRetry ? "Import failed. Retry the same file or choose a different file." : "Import failed. Choose a different file.");
    } finally {
      setImporting(false);
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
        <fieldset disabled={importing} className="form-fieldset">
        <section className="form-section import-section" aria-labelledby="import-title">
          <div className="section-heading"><p className="eyebrow">New</p><h2 id="import-title">Scan or upload a recipe</h2><p className="muted">We’ll prepare an editable draft. Nothing is saved until you review it and choose Save recipe.</p></div>
          <p className="form-help">Your selected file is sent to Google Gemini for extraction. Temporary source files are deleted after processing when cleanup succeeds. Review everything before saving.</p>
          <label className="import-picker" htmlFor="recipe-import">Choose a PDF or paper recipe<input ref={importInputRef} id="recipe-import" aria-label="Choose a PDF or paper recipe" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" disabled={importing} onChange={(event) => void importFile(event.target.files?.[0])} /><span>PDF, JPEG, PNG, or WebP · up to 10 MB · printed recipes work best</span></label>
          {importStatus && <p className="form-help" role="status" aria-live="polite">{importing ? `${importStatus} Reading recipe…` : importStatus}</p>}
          {!importing && importStatus && <div className="import-recovery">{retryFile && <button className="button button-secondary" type="button" onClick={() => void importFile(retryFile)}>Retry import</button>}<button className="text-button" type="button" onClick={() => { setRetryFile(null); setError(""); setImportStatus(""); importInputRef.current?.click(); }}>Choose a different file</button></div>}
          {importWarning && <div className="notice warning" role="alert">{importWarning}</div>}
        </section>
        <section className="form-section">
          <div className="section-heading"><p className="eyebrow">Start here</p><h2>Recipe details</h2></div>
          <div className="form-grid form-grid-wide">
            <label htmlFor="recipe-title">Recipe title<input id="recipe-title" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Weeknight tomato pasta" required /></label>
            <label htmlFor="recipe-description">Description<textarea id="recipe-description" value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="What makes this recipe worth saving?" rows={3} /></label>
          </div>
          <div className="form-grid form-grid-three">
            <label htmlFor="prep-minutes">Prep minutes<input id="prep-minutes" type="number" min="0" value={draft.prepMinutes} onChange={(event) => update("prepMinutes", event.target.value)} /></label>
            <label htmlFor="cook-minutes">Cook minutes<input id="cook-minutes" type="number" min="0" value={draft.cookMinutes} onChange={(event) => update("cookMinutes", event.target.value)} /></label>
            <label htmlFor="servings">Servings<input id="servings" type="number" min="1" value={draft.servings} onChange={(event) => update("servings", event.target.value)} /></label>
          </div>
          <label htmlFor="difficulty">Difficulty<select id="difficulty" value={draft.difficulty} onChange={(event) => update("difficulty", event.target.value as Difficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        </section>

        <section className="form-section">
          <div className="section-heading"><p className="eyebrow">Add a visual</p><h2>Recipe image</h2></div>
          <label htmlFor="recipe-image">Optional image<input id="recipe-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setError("");
            if (!file) {
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setImageFile(null);
              setImagePreview("");
              return;
            }
            try {
              validateRecipeImage(file);
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setImageFile(file);
              setImagePreview(URL.createObjectURL(file));
            } catch (caught) {
              event.target.value = "";
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setImageFile(null);
              setImagePreview("");
              setError(caught instanceof Error ? caught.message : "Unable to use that image.");
            }
          }} /></label>
          {imagePreview && <div className="image-preview"><img src={imagePreview} alt="Recipe preview" /><button className="text-button" type="button" onClick={() => { URL.revokeObjectURL(imagePreview); setImageFile(null); setImagePreview(""); }}>Remove image</button></div>}
          <p className="muted form-help">JPEG, PNG, or WebP up to 5 MB.</p>
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
          <label htmlFor="instructions">Cooking instructions<textarea id="instructions" value={draft.instructions} onChange={(event) => update("instructions", event.target.value)} placeholder="Write the steps in the order you cook them." rows={9} required /></label>
        </section>

        <div className="form-actions"><Link className="button button-secondary" to="/">Cancel</Link><button className="button button-primary" type="submit" disabled={busy || importing}>{busy ? "Saving…" : importing ? "Reading…" : "Save recipe"}</button></div>
        </fieldset>
      </form>
    </main>
  );
}
