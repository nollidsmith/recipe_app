import { supabase } from "./supabase";
import { toUserFacingError } from "./errors";
import type { RecipeDraft, RecipeImportResult, RecipeImportStatus } from "../types/recipe";

export const RECIPE_IMPORT_BUCKET = "recipe-imports";
export const MAX_RECIPE_IMPORT_BYTES = 10 * 1024 * 1024;
export const RECIPE_IMPORT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function validateRecipeImport(file: File) {
  if (!RECIPE_IMPORT_TYPES.has(file.type)) {
    throw new Error("Choose a PDF, JPEG, PNG, or WebP recipe file.");
  }
  if (file.size > MAX_RECIPE_IMPORT_BYTES) {
    throw new Error("Recipe imports must be 10 MB or smaller.");
  }
}

function emptyDraft(): RecipeDraft {
  return { title: "", description: "", instructions: "", prepMinutes: "", cookMinutes: "", servings: "", difficulty: "easy", ingredients: [] };
}

function sourceName(file: File) {
  return file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "recipe-source";
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toUserFacingError(error, "Unable to verify your session.");
  if (!data.user) throw new Error("Your session has expired. Sign in again before importing a recipe.");
  return data.user.id;
}

export type RecipeImportRow = {
  status: RecipeImportStatus;
  draft_json: RecipeDraft | null;
  confidence_json: Record<string, number> | null;
  warnings_json: string[] | null;
  error_message: string | null;
  source_filename: string;
};

export async function pollRecipeImport(
  read: () => Promise<RecipeImportRow>,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)),
): Promise<RecipeImportResult> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const row = await read();
    if (row.status === "ready" || row.status === "needs_review") {
      return { draft: row.draft_json ?? emptyDraft(), warnings: row.warnings_json ?? [], confidence: row.confidence_json ?? {}, sourceName: row.source_filename };
    }
    if (row.status === "failed") throw new Error(row.error_message || "We could not read that recipe. Try a clearer scan or a different file.");
    await sleep(700);
  }
  throw new Error("Recipe reading timed out. Use Retry import or choose the file again.");
}

export async function importRecipeFile(file: File) {
  validateRecipeImport(file);
  const userId = await currentUserId();
  const importId = crypto.randomUUID();
  const fileName = sourceName(file);
  const path = `${userId}/${importId}/source/${fileName}`;
  const { data: job, error: jobError } = await supabase.from("recipe_imports").insert({ id: importId, user_id: userId, source_path: path, source_filename: fileName, mime_type: file.type, byte_size: file.size, status: "queued" }).select("id").single();
  if (jobError || !job) throw toUserFacingError(jobError, "Unable to start the recipe import.");

  const { error: uploadError } = await supabase.storage.from(RECIPE_IMPORT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase.from("recipe_imports").delete().eq("id", job.id);
    throw toUserFacingError(uploadError, "Unable to upload the recipe source.");
  }

  const { error: functionError } = await supabase.functions.invoke("recipe-import", { body: { importId: job.id } });
  if (functionError) {
    await supabase.storage.from(RECIPE_IMPORT_BUCKET).remove([path]);
    await supabase.from("recipe_imports").delete().eq("id", job.id);
    throw toUserFacingError(functionError, "Recipe reading is temporarily unavailable. Try again.");
  }
  return pollRecipeImport(async () => {
    const { data, error } = await supabase.from("recipe_imports").select("status, draft_json, confidence_json, warnings_json, error_message, source_filename").eq("id", job.id).single();
    if (error) throw toUserFacingError(error, "Unable to check recipe import progress.");
    return data as RecipeImportRow;
  });
}
