import { supabase } from "./supabase";
import type { PantryItem, PantryItemDraft } from "../types/pantry";
import { removeStorageFile, toUserFacingError } from "./errors";

export const PANTRY_IMAGE_BUCKET = "pantry-images";
const MAX_PANTRY_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PANTRY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export async function listPantryItems() {
  const { data, error } = await supabase
    .from("pantry_items")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw toUserFacingError(error, "Unable to load your stock.");
  const items = (data ?? []) as PantryItem[];
  return Promise.all(items.map(async (item) => ({
    ...item,
    image_url: item.image_path ? await getPantryImageUrl(item.image_path) : null,
  })));
}

export function validatePantryImage(file: File) {
  if (!ALLOWED_PANTRY_IMAGE_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > MAX_PANTRY_IMAGE_BYTES) throw new Error("Stock images must be 5 MB or smaller.");
}

function imageExtension(file: File) {
  return file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
}

async function getPantryImageUrl(path: string) {
  const { data, error } = await supabase.storage.from(PANTRY_IMAGE_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw toUserFacingError(error, "Unable to create a stock image URL.");
  return data.signedUrl;
}

export async function createPantryItem(draft: PantryItemDraft) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw toUserFacingError(userError, "Unable to verify your session.");
  if (!userData.user) throw new Error("Your session has expired. Sign in again before adding stock.");

  const name = draft.name.trim();
  if (!name) throw new Error("Enter an item name.");
  if (!draft.unit.trim()) throw new Error("Enter a unit.");

  if (draft.image) validatePantryImage(draft.image);

  const { data, error } = await supabase
    .from("pantry_items")
    .insert({
      user_id: userData.user.id,
      name,
      quantity: requiredNumber(draft.quantity),
      unit: draft.unit.trim(),
      category: draft.category.trim() || null,
      low_stock_threshold: optionalNumber(draft.lowStockThreshold),
      expires_on: draft.expiresOn || null,
    })
    .select("*")
    .single();

  if (error) throw toUserFacingError(error, "Unable to add that stock item.");
  const item = data as PantryItem;

  if (!draft.image) return item;
  const path = `${userData.user.id}/pantry/${item.id}/${crypto.randomUUID()}.${imageExtension(draft.image)}`;
  const { error: uploadError } = await supabase.storage.from(PANTRY_IMAGE_BUCKET).upload(path, draft.image, { contentType: draft.image.type, upsert: false });
  if (uploadError) {
    const { error: rollbackError } = await supabase.from("pantry_items").delete().eq("id", item.id);
    if (rollbackError) console.error("Pantry item rollback failed after upload error", rollbackError);
    throw toUserFacingError(uploadError, "Unable to upload the stock image.");
  }
  const { data: updated, error: updateError } = await supabase.from("pantry_items").update({ image_path: path }).eq("id", item.id).select("*").single();
  if (updateError) {
    await removeStorageFile(supabase.storage.from(PANTRY_IMAGE_BUCKET), path, "stock image rollback");
    const { error: rollbackError } = await supabase.from("pantry_items").delete().eq("id", item.id);
    if (rollbackError) console.error("Pantry item rollback failed after update error", rollbackError);
    throw toUserFacingError(updateError, "Unable to save the stock image.");
  }
  return { ...(updated as PantryItem), image_url: await getPantryImageUrl(path) };
}

export async function updatePantryQuantity(id: string, quantity: number) {
  const { data, error } = await supabase
    .from("pantry_items")
    .update({ quantity: Math.max(0, quantity) })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw toUserFacingError(error, "Unable to update that stock item.");
  return data as PantryItem;
}

export async function deletePantryItem(id: string) {
  const { data: item, error: findError } = await supabase.from("pantry_items").select("image_path").eq("id", id).maybeSingle();
  if (findError) throw toUserFacingError(findError, "Unable to find that stock item.");

  if (item?.image_path) {
    await removeStorageFile(supabase.storage.from(PANTRY_IMAGE_BUCKET), item.image_path, "stock deletion", true);
  }

  const { error } = await supabase.from("pantry_items").delete().eq("id", id);
  if (error) throw toUserFacingError(error, "Unable to delete that stock item.");
}
