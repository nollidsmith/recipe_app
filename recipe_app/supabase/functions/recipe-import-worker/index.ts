import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const workerToken = Deno.env.get("RECIPE_IMPORT_WORKER_TOKEN");

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  if (!supabaseUrl || !serviceRoleKey || !workerToken) {
    return new Response(JSON.stringify({ error: "worker_not_configured" }), { status: 503 });
  }
  if (request.headers.get("Authorization") !== `Bearer ${workerToken}`) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 });
  }

  const requestBody = await request.json().catch(() => ({}));
  if (requestBody?.preflight === true) {
    return new Response(JSON.stringify({
      providerConfigured: Boolean(Deno.env.get("GEMINI_API_KEY")),
      workerConfigured: true,
    }), { status: Deno.env.get("GEMINI_API_KEY") ? 200 : 503, headers: { "Content-Type": "application/json" } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: messages, error: readError } = await admin.rpc("read_recipe_import_queue", { p_visibility_timeout: 120, p_limit: 5 });
  if (readError) return new Response(JSON.stringify({ error: "queue_unavailable" }), { status: 503 });

  let processed = 0;
  for (const message of messages ?? []) {
    const importId = typeof message.message?.import_id === "string" ? message.message.import_id : null;
    if (!importId) {
      await admin.rpc("delete_recipe_import_queue_message", { p_message_id: message.message_id });
      continue;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/recipe-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${workerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ importId }),
    });

    // Delete after a terminal application response. A network/5xx failure leaves
    // the pgmq message visible after its timeout so it can be retried.
    if (response.status < 500) {
      await admin.rpc("delete_recipe_import_queue_message", { p_message_id: message.message_id });
      processed += 1;
    }
  }

  return new Response(JSON.stringify({ processed, queued: messages?.length ?? 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
});
