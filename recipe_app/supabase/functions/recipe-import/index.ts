import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type Draft = {
  title: string;
  description: string;
  instructions: string;
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  difficulty: "easy" | "medium" | "hard";
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null; notes: string | null }>;
};

type ImportJob = {
  id: string;
  user_id: string;
  source_path: string | null;
  source_filename: string;
  mime_type: string;
  byte_size: number;
  status: string;
  attempt_count: number;
  updated_at: string;
};

type EdgeRuntimeWithWaitUntil = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "https://recipe.dillonlsmith.com"];
const allowedOrigins = new Set((Deno.env.get("RECIPE_IMPORT_ALLOWED_ORIGINS") ?? defaultOrigins.join(",")).split(",").map((origin) => origin.trim()).filter(Boolean));
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(request: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) }); }

function normalizeDraft(value: unknown): Draft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<Draft>;
  if (typeof draft.title !== "string" || typeof draft.description !== "string" || typeof draft.instructions !== "string" || typeof draft.prepMinutes !== "string" || typeof draft.cookMinutes !== "string" || typeof draft.servings !== "string" || !["easy", "medium", "hard"].includes(draft.difficulty ?? "") || !Array.isArray(draft.ingredients)) return null;
  const difficulty = draft.difficulty as Draft["difficulty"];
  const boundedString = (value: string, max: number) => value.length <= max ? value.trim() : null;
  const numberText = (value: string, positive = false) => !value || (/^\d{1,4}$/.test(value) && (!positive || Number(value) > 0));
  const title = boundedString(draft.title, 200);
  const description = boundedString(draft.description, 5000);
  const instructions = boundedString(draft.instructions, 12000);
  const prepMinutes = boundedString(draft.prepMinutes, 40);
  const cookMinutes = boundedString(draft.cookMinutes, 40);
  const servings = boundedString(draft.servings, 40);
  if (!title || !description || !instructions || !prepMinutes || !cookMinutes || !servings || !title.trim() || !instructions.trim() || !numberText(prepMinutes) || !numberText(cookMinutes) || !numberText(servings, true) || draft.ingredients.length > 100) return null;
  const ingredients = draft.ingredients.map((ingredient) => {
    if (!ingredient || typeof ingredient.name !== "string" || (ingredient.quantity !== null && (typeof ingredient.quantity !== "number" || !Number.isFinite(ingredient.quantity) || ingredient.quantity < 0)) || ingredient.name.length > 240 || (ingredient.unit !== null && (typeof ingredient.unit !== "string" || ingredient.unit.length > 80)) || (ingredient.notes !== null && (typeof ingredient.notes !== "string" || ingredient.notes.length > 240))) return null;
    return { name: ingredient.name.trim(), quantity: ingredient.quantity, unit: ingredient.unit?.trim() || null, notes: ingredient.notes?.trim() || null };
  });
  if (ingredients.some((ingredient) => !ingredient || !ingredient.name)) return null;
  return {
    title, description, instructions, prepMinutes, cookMinutes, servings,
    difficulty,
    ingredients,
  };
}

function normalizeWarnings(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.slice(0, 20).map((item) => item.trim().slice(0, 300)).filter(Boolean)
    : null;
}

function normalizeConfidence(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 50 || entries.some(([, score]) => typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1)) return null;
  return Object.fromEntries(entries.map(([field, score]) => [field.slice(0, 80), score]));
}

async function reapExpiredSources() {
  const { data: expired } = await admin.from("recipe_imports").select("id, source_path").not("source_path", "is", null).lt("expires_at", new Date().toISOString()).limit(25);
  for (const job of expired ?? []) {
    if (!job.source_path) continue;
    const { error } = await admin.storage.from("recipe-imports").remove([job.source_path]);
    if (!error) {
      await admin.from("recipe_imports").update({ source_path: null, error_code: "source_expired", error_message: "Temporary source removed after its retention window." }).eq("id", job.id);
    } else {
      await admin.from("recipe_imports").update({ error_code: "source_cleanup_pending", error_message: "Temporary source cleanup is pending and will be retried." }).eq("id", job.id).not("source_path", "is", null);
    }
  }
}

function scheduleBackgroundWork(work: Promise<unknown>) {
  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: EdgeRuntimeWithWaitUntil }).EdgeRuntime;
  if (typeof runtime?.waitUntil === "function") {
    runtime.waitUntil(work);
    return true;
  }
  return false;
}

async function processClaimedImport(request: Request, job: ImportJob) {
  try {
    if (!job.source_path) throw new Error("source_unavailable");
    const { data: source, error: downloadError } = await admin.storage.from("recipe-imports").download(job.source_path);
    if (downloadError || !source) throw new Error("source_unavailable");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("provider_not_configured");
    const bytes = new Uint8Array(await source.arrayBuffer());
    if (job.mime_type === "application/pdf") validatePdf(bytes);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const prompt = "Read this recipe document or photograph. Return an editable recipe draft. Do not invent missing values: use empty strings, nulls, and warnings when text is unclear. Convert quantities to numbers when possible. Flag uncertain ingredients, quantities, temperatures, and timings in warnings and confidence scores from 0 to 1.";
    const responseJsonSchema = {
      type: "object",
      properties: {
        draft: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, instructions: { type: "string" }, prepMinutes: { type: "string" }, cookMinutes: { type: "string" }, servings: { type: "string" }, difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, ingredients: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { anyOf: [{ type: "number" }, { type: "null" }] }, unit: { anyOf: [{ type: "string" }, { type: "null" }] }, notes: { anyOf: [{ type: "string" }, { type: "null" }] } }, required: ["name", "quantity", "unit", "notes"] } } }, required: ["title", "description", "instructions", "prepMinutes", "cookMinutes", "servings", "difficulty", "ingredients"] },
        warnings: { type: "array", items: { type: "string" } },
        confidence: { type: "object", additionalProperties: { type: "number" } },
      },
      required: ["draft", "warnings", "confidence"],
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: job.mime_type, data: btoa(binary) } }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema, maxOutputTokens: 4000 } }), signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!providerResponse.ok) throw new Error("provider_failed");
    const geminiResult = await providerResponse.json();
    const text = geminiResult.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
    if (!text) throw new Error("invalid_provider_result");
    const result = JSON.parse(text);
    const draft = normalizeDraft(result.draft);
    const warnings = normalizeWarnings(result.warnings ?? []);
    const confidence = normalizeConfidence(result.confidence ?? {});
    if (!draft || !warnings || !confidence) throw new Error("invalid_provider_result");

    const status = warnings.length > 0 || Object.values(confidence).some((score) => score < 0.7) ? "needs_review" : "ready";
    const requestId = typeof result.requestId === "string" ? result.requestId.slice(0, 200) : null;
    const { error: saveError } = await admin.from("recipe_imports").update({ status, draft_json: draft, confidence_json: confidence, warnings_json: warnings, provider_request_id: requestId }).eq("id", job.id);
    if (saveError) throw new Error("draft_persist_failed");
    const { error: removeError } = await admin.storage.from("recipe-imports").remove([job.source_path]);
    if (removeError) await admin.from("recipe_imports").update({ error_code: "source_cleanup_pending", error_message: "The extracted draft is ready, but the temporary source still needs cleanup." }).eq("id", job.id);
    else await admin.from("recipe_imports").update({ source_path: null }).eq("id", job.id);
    return json(request, { status });
  } catch (error) {
    const code = error instanceof Error ? error.message : "import_failed";
    const messages: Record<string, string> = { provider_not_configured: "Recipe import is not configured yet. Add the Gemini API key in Supabase.", source_unavailable: "The uploaded recipe could not be opened.", provider_failed: "The recipe reader could not process this file.", invalid_provider_result: "The recipe reader returned an invalid draft.", invalid_pdf: "That file is not a readable PDF.", pdf_page_count_unavailable: "This PDF could not be safely checked for page count. Try exporting it again or upload a photo instead.", pdf_page_limit_exceeded: `PDFs must contain ${MAX_PDF_PAGES} pages or fewer.` };
    const retryable = new Set(["provider_failed", "source_unavailable", "draft_persist_failed", "import_failed"]);
    if (retryable.has(code) && job.attempt_count < 3) {
      await admin.from("recipe_imports").update({ status: "queued", error_code: code, error_message: messages[code] ?? "The import will be retried." }).eq("id", job.id).eq("status", "processing");
      return json(request, { status: "queued", retryable: true }, 503);
    }

    let sourceCleanupPending = false;
    if (job.source_path) {
      const { error: removeError } = await admin.storage.from("recipe-imports").remove([job.source_path]);
      sourceCleanupPending = Boolean(removeError);
    }
    await admin.from("recipe_imports").update({ status: "failed", source_path: sourceCleanupPending ? job.source_path : null, error_code: sourceCleanupPending ? "source_cleanup_pending" : code, error_message: sourceCleanupPending ? "The import failed and its temporary source still needs cleanup." : messages[code] ?? "We could not read that recipe. Try a clearer scan or a different file." }).eq("id", job.id).eq("status", "processing");
    return json(request, { error: code, status: "failed" }, 502);
  }
}

const MAX_PDF_PAGES = 20;

function validatePdf(bytes: Uint8Array) {
  const header = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!header.startsWith("%PDF-")) throw new Error("invalid_pdf");

  // This dependency-free guard only counts visible page dictionaries. PDFs
  // whose page tree is compressed or encoded without visible markers fail
  // closed rather than bypassing the limit. It is not a full PDF parser.
  const text = new TextDecoder("latin1").decode(bytes);
  const pageCount = (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
  if (pageCount === 0) throw new Error("pdf_page_count_unavailable");
  if (pageCount > MAX_PDF_PAGES) throw new Error("pdf_page_limit_exceeded");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return json(request, { error: "origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "method_not_allowed" }, 405);
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json(request, { error: "not_authenticated" }, 401);
  const workerToken = Deno.env.get("RECIPE_IMPORT_WORKER_TOKEN");
  const isWorker = Boolean(workerToken && authHeader === `Bearer ${workerToken}`);
  const queueReady = Deno.env.get("RECIPE_IMPORT_QUEUE_READY") === "true";
  let userId: string | null = null;
  if (!isWorker) {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(request, { error: "not_authenticated" }, 401);
    userId = user.id;
  }

  // Only the token-authenticated worker/scheduler may perform global cleanup.
  // Regular user requests must remain scoped to their own import job.
  if (isWorker) await reapExpiredSources();

  const { importId } = await request.json().catch(() => ({ importId: "" }));
  if (typeof importId !== "string" || !importId) return json(request, { error: "invalid_import_id" }, 400);

  let jobQuery = admin.from("recipe_imports").select("*").eq("id", importId);
  if (userId) jobQuery = jobQuery.eq("user_id", userId);
  const { data: jobData, error: jobError } = await jobQuery.single();
  const job = jobData as ImportJob | null;
  if (jobError || !job) return json(request, { error: "import_not_found" }, 404);
  if (job.status === "ready" || job.status === "needs_review") return json(request, { status: job.status });
  if (job.status === "failed") return json(request, { status: job.status }, 202);
  if (!job.source_path) return json(request, { error: "import_not_found" }, 404);
  if (!allowedTypes.has(job.mime_type) || job.byte_size > MAX_BYTES) return json(request, { error: "invalid_source" }, 400);

  const expectedPrefix = `${job.user_id}/${job.id}/source/`;
  const expectedPath = `${expectedPrefix}${job.source_filename}`;
  if (job.source_path !== expectedPath || !/^[a-zA-Z0-9._-]+$/.test(job.source_filename)) return json(request, { error: "invalid_source_path" }, 400);
  // Do not acknowledge queued work solely from configuration flags. The
  // database trigger may decline to enqueue when scheduler/Vault prerequisites
  // are unavailable, so claiming here keeps the inline path from stranding jobs.
  if (job.status === "processing" && Date.now() - new Date(job.updated_at).getTime() > 60000 && job.attempt_count < 3) {
    await admin.from("recipe_imports").update({ status: "queued" }).eq("id", importId).eq("status", "processing");
    job.status = "queued";
  }
  if (job.status !== "queued") return json(request, { status: job.status }, 202);
  if (job.attempt_count >= 3) return json(request, { error: "retry_limit_reached" }, 429);

  const nextAttempt = job.attempt_count + 1;
  const { data: claimed, error: claimError } = await admin.from("recipe_imports").update({ status: "processing", attempt_count: nextAttempt, error_code: null, error_message: null }).eq("id", importId).eq("status", "queued").select("id").maybeSingle();
  if (claimError) return json(request, { error: "claim_failed" }, 500);
  if (!claimed) return json(request, { status: "processing" }, 202);

  const processingJob = { ...job, status: "processing", attempt_count: nextAttempt, updated_at: new Date().toISOString() };
  const processing = processClaimedImport(request, processingJob);
  if (!isWorker && scheduleBackgroundWork(processing)) return json(request, { status: "processing" }, 202);
  return await processing;
});
