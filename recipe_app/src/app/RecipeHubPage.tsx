import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteRecipe, listRecipes } from "../lib/recipes";
import type { Recipe } from "../types/recipe";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";

export default function RecipeHubPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Recipe | null>(null);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setError("");
    setLoadFailed(false);
    try {
      setRecipes(await listRecipes());
    } catch (caught) {
      setLoadFailed(true);
      setError(caught instanceof Error ? caught.message : "Unable to load your recipes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecipes(); }, [loadRecipes]);

  const remove = async (recipe: Recipe) => {
    try {
      await deleteRecipe(recipe.id);
      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
      setToast(`${recipe.title} deleted.`);
      window.setTimeout(() => setToast(""), 2800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete this recipe.");
    }
  };

  return (
    <section className="recipe-section" aria-labelledby="recipes-title">
      <Toast message={toast} />
      {pendingDelete && <ConfirmDialog title={`Delete ${pendingDelete.title}?`} description="This cannot be undone." confirmLabel="Delete recipe" onCancel={() => setPendingDelete(null)} onConfirm={() => { const recipe = pendingDelete; setPendingDelete(null); void remove(recipe); }} />}
      <div className="section-heading section-heading-inline"><div><p className="eyebrow">Your collection</p><h2 id="recipes-title">Recipes</h2></div><div className="recipe-actions"><Link className="button button-secondary" to="/recipes/new#import-title">Scan or upload</Link><Link className="button button-primary" to="/recipes/new">+ Add recipe</Link></div></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {loading && <div className="recipe-state" role="status" aria-live="polite">Loading your recipes…</div>}
      {!loading && loadFailed && <div className="empty-state"><span className="empty-icon">!</span><h3>We couldn’t load your recipes.</h3><p className="muted">Check your connection and try again.</p><button className="button button-primary" type="button" onClick={() => void loadRecipes()}>Try again</button></div>}
      {!loading && !loadFailed && recipes.length === 0 && <div className="empty-state"><span className="empty-icon">✦</span><h3>Your recipe book is waiting.</h3><p className="muted">Save your first recipe and build a collection that belongs to you.</p><Link className="button button-primary" to="/recipes/new">Create your first recipe</Link></div>}
      {!loading && !loadFailed && recipes.length > 0 && <div className="recipe-grid">{recipes.map((recipe) => <article className="recipe-card" key={recipe.id}>{recipe.image_url && <img className="recipe-card-image" alt={`${recipe.title} recipe`} src={recipe.image_url} />}<div className="recipe-card-top"><span className="recipe-badge">{recipe.difficulty ?? "recipe"}</span><button className="text-button" type="button" onClick={() => setPendingDelete(recipe)}>Delete</button></div><h3>{recipe.title}</h3>{recipe.description && <p>{recipe.description}</p>}<div className="recipe-meta"><span>{recipe.recipe_ingredients.length} ingredients</span>{recipe.servings && <span>{recipe.servings} servings</span>}{recipe.cook_minutes && <span>{recipe.cook_minutes} min</span>}</div><details><summary>View instructions</summary><p className="instructions">{recipe.instructions}</p></details></article>)}</div>}
    </section>
  );
}
