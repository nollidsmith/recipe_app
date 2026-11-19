import { supabase } from "./supabase";
import type { Recipe, RecipeDraft, RecipeIngredient } from "../types/recipe";

type RecipeRow = Omit<Recipe, "recipe_ingredients"> & {
  recipe_ingredients: RecipeIngredient[] | null;
};

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function listRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RecipeRow[]).map((recipe) => ({
    ...recipe,
    recipe_ingredients: recipe.recipe_ingredients ?? [],
  }));
}

export async function createRecipe(draft: RecipeDraft) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Your session has expired. Sign in again before saving a recipe.");

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      user_id: userData.user.id,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      instructions: draft.instructions.trim(),
      prep_minutes: optionalNumber(draft.prepMinutes),
      cook_minutes: optionalNumber(draft.cookMinutes),
      servings: optionalNumber(draft.servings),
      difficulty: draft.difficulty,
    })
    .select("id")
    .single();

  if (recipeError) throw recipeError;

  const ingredients = draft.ingredients
    .map((ingredient, index) => ({
      recipe_id: recipe.id,
      name: ingredient.name.trim(),
      quantity: ingredient.quantity,
      unit: ingredient.unit?.trim() || null,
      notes: ingredient.notes?.trim() || null,
      position: index,
    }))
    .filter((ingredient) => ingredient.name.length > 0);

  if (ingredients.length > 0) {
    const { error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .insert(ingredients);

    if (ingredientError) {
      await supabase.from("recipes").delete().eq("id", recipe.id);
      throw ingredientError;
    }
  }

  return recipe.id;
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}
