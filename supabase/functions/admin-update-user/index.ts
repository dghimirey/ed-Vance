import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Only admins can update users" }, 403);

    const { user_id, name, email, password, role } = await req.json();
    if (!user_id) return json({ error: "Missing user_id" }, 400);

    const authPatch: Record<string, unknown> = {};
    if (email) authPatch.email = email;
    if (password) authPatch.password = password;
    if (name) authPatch.user_metadata = { name };
    if (Object.keys(authPatch).length > 0) {
      const { error: authErr } = await adminClient.auth.admin.updateUserById(user_id, authPatch);
      if (authErr) return json({ error: authErr.message }, 400);
    }

    if (name || email) {
      const profPatch: Record<string, unknown> = {};
      if (name) profPatch.name = name;
      if (email) profPatch.email = email;
      const { error: profErr } = await adminClient.from("profiles").update(profPatch).eq("user_id", user_id);
      if (profErr) return json({ error: `Profile update failed: ${profErr.message}` }, 500);
    }

    if (role) {
      const { data: existing } = await adminClient.from("user_roles").select("id, role").eq("user_id", user_id).maybeSingle();
      if (existing && existing.role !== role) {
        const { error } = await adminClient.from("user_roles").update({ role }).eq("user_id", user_id);
        if (error) return json({ error: `Role update failed: ${error.message}` }, 500);
      } else if (!existing) {
        const { error } = await adminClient.from("user_roles").insert({ user_id, role });
        if (error) return json({ error: `Role insert failed: ${error.message}` }, 500);
      }
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});