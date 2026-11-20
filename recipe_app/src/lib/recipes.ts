import { supabase } from "./supabase";
import type { Recipe, RecipeDraft, RecipeIngredient } from "../types/recipe";
import { removeStorageFile, toUserFacingError } from "./errors";

export const RECIPE_IMAGE_BUCKET = "recipe-images";
const MAX_RECIPE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECIPE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

  if (error) throw toUserFacingError(error, "Unable to load your recipes.");
  const recipes = ((data ?? []) as RecipeRow[]).map((recipe) => ({
    ...recipe,
    recipe_ingredients: recipe.recipe_ingredients ?? [],
  }));

  return Promise.all(recipes.map(async (recipe) => ({
    ...recipe,
    image_url: recipe.image_path ? await getRecipeImageUrl(recipe.image_path) : null,
  })));
}

export function validateRecipeImage(file: File) {
  if (!ALLOWED_RECIPE_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_RECIPE_IMAGE_BYTES) {
    throw new Error("Recipe images must be 5 MB or smaller.");
  }
}

function imageExtension(file: File) {
  return file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
}

export async function uploadRecipeImage(recipeId: string, file: File) {
  validateRecipeImage(file);

  const { data: existingRecipe, error: existingError } = await supabase
    .from("recipes")
    .select("image_path")
    .eq("id", recipeId)
    .maybeSingle();
  if (existingError) throw toUserFacingError(existingError, "Unable to prepare the recipe image.");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw toUserFacingError(userError, "Unable to verify your session.");
  if (!userData.user) throw new Error("Your session has expired. Sign in again before uploading an image.");

  const path = `${userData.user.id}/recipes/${recipeId}/${crypto.randomUUID()}.${imageExtension(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(RECIPE_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw toUserFacingError(uploadError, "Unable to upload the recipe image.");

  const { error: updateError } = await supabase
    .from("recipes")
    .update({ image_path: path })
    .eq("id", recipeId);

  if (updateError) {
    await removeStorageFile(supabase.storage.from(RECIPE_IMAGE_BUCKET), path, "recipe image rollback");
    throw toUserFacingError(updateError, "Unable to save the recipe image.");
  }

  if (existingRecipe?.image_path && existingRecipe.image_path !== path) {
    await removeStorageFile(supabase.storage.from(RECIPE_IMAGE_BUCKET), existingRecipe.image_path, "replaced recipe image");
  }

  return path;
}

export async function getRecipeImageUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(RECIPE_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw toUserFacingError(error, "Unable to create a recipe image URL.");
  return data.signedUrl;
}

export async function createRecipe(draft: RecipeDraft) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw toUserFacingError(userError, "Unable to verify your session.");
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

  if (recipeError) throw toUserFacingError(recipeError, "Unable to save your recipe.");

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
      const { error: rollbackError } = await supabase.from("recipes").delete().eq("id", recipe.id);
      if (rollbackError) console.error("Recipe rollback failed", rollbackError);
      throw toUserFacingError(ingredientError, "Unable to save the recipe ingredients.");
    }
  }

  return recipe.id;
}

export async function deleteRecipe(id: string) {
  const { data: recipe, error: findError } = await supabase
    .from("recipes")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw toUserFacingError(findError, "Unable to find that recipe.");

  if (recipe?.image_path) {
    await removeStorageFile(supabase.storage.from(RECIPE_IMAGE_BUCKET), recipe.image_path, "recipe deletion", true);
  }

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw toUserFacingError(error, "Unable to delete that recipe.");
}
