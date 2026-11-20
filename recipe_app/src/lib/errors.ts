type SupabaseLikeError = {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: number;
};

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return typeof value === "object" && value !== null && ("message" in value || "code" in value || "status" in value);
}

export function toUserFacingError(value: unknown, fallback: string) {
  if (value instanceof Error) return value;
  const error = isSupabaseLikeError(value) ? value : {};
  const message = error.message?.toLowerCase() ?? "";

  if (error.code === "23505" || message.includes("duplicate")) return new Error("That record already exists.");
  if (error.code === "23503" || message.includes("foreign key")) return new Error("That item is no longer available. Refresh and try again.");
  if (error.code === "42501" || message.includes("permission denied") || message.includes("row-level security")) return new Error("You do not have permission to perform that action.");
  if (error.status === 401 || error.statusCode === 401 || message.includes("jwt") || message.includes("not authenticated")) return new Error("Your session has expired. Sign in again and try again.");
  if (error.status === 404 || error.statusCode === 404 || message.includes("not found")) return new Error("That item could not be found. Refresh and try again.");
  if (message.includes("network") || message.includes("fetch")) return new Error("We couldn't reach the service. Check your connection and try again.");
  return new Error(fallback);
}

export function isMissingStorageObject(value: unknown) {
  if (!isSupabaseLikeError(value)) return false;
  const message = value.message?.toLowerCase() ?? "";
  return value.status === 404 || value.statusCode === 404 || message.includes("not found") || message.includes("object does not exist");
}

type StorageClient = {
  remove: (paths: string[]) => Promise<{ error: unknown | null }>;
};

export async function removeStorageFile(storage: StorageClient, path: string, context: string, required = false) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await storage.remove([path]);
    if (!error || isMissingStorageObject(error)) return;
    if (attempt < 2) continue;
    console.error(`Storage cleanup failed (${context})`, error);
    if (required) throw toUserFacingError(error, "We couldn't clean up the image. Try again.");
  }
}
