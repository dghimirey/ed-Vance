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
    if (!roleData) return json({ error: "Only admins can delete users" }, 403);

    const { user_id, force } = await req.json();
    if (!user_id) return json({ error: "Missing user_id" }, 400);
    if (user_id === caller.id) return json({ error: "You cannot delete your own admin account" }, 400);

    const { data: target } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
    if (!target) return json({ error: "User not found" }, 404);

    if (target.role === "admin") {
      const { count } = await adminClient.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) return json({ error: "Cannot delete the only remaining admin" }, 400);
    }

    if (target.role === "teacher") {
      const { count } = await adminClient.from("teacher_assignments").select("id", { count: "exact", head: true }).eq("teacher_id", user_id);
      if ((count ?? 0) > 0 && !force) {
        return json({ error: "Teacher has active class assignments", dependency: { type: "teacher_assignments", count } }, 409);
      }
      if (force) await adminClient.from("teacher_assignments").delete().eq("teacher_id", user_id);
    }
    if (target.role === "parent") {
      const { count: linkedCount } = await adminClient.from("student_parents").select("id", { count: "exact", head: true }).eq("parent_id", user_id);
      const { count: legacyCount } = await adminClient.from("students").select("id", { count: "exact", head: true }).eq("parent_id", user_id);
      const total = (linkedCount ?? 0) + (legacyCount ?? 0);
      if (total > 0 && !force) {
        return json({ error: "Parent is linked to one or more students", dependency: { type: "student_parents", count: total } }, 409);
      }
      if (force) {
        await adminClient.from("student_parents").delete().eq("parent_id", user_id);
        await adminClient.from("students").update({ parent_id: null }).eq("parent_id", user_id);
      }
    }

    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("profiles").delete().eq("user_id", user_id);
    const { error: authErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (authErr) return json({ error: `Auth delete failed: ${authErr.message}` }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});