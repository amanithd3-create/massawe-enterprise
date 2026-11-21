
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const send = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") return send({ error: "POST required" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return send({ error: "Sign in required" }, 401);
    }

    const client = createClient(url, key);
    const { data: userData, error: userError } =
      await client.auth.getUser(auth.slice(7));

    if (userError || !userData.user) {
      return send({ error: "Invalid session" }, 401);
    }

    const body = await req.json();
    const platformName = String(body.platform_name || "").trim();
    const website = String(body.website_url || "").trim();

    if (platformName.length < 2 || platformName.length > 120) {
      return send({ error: "Enter a valid platform name" }, 400);
    }

    if (website) {
      try {
        const parsed = new URL(website);
        if (parsed.protocol !== "https:") throw new Error();
      } catch {
        return send({ error: "Enter a valid HTTPS website URL" }, 400);
      }
    }

    const admin = createClient(url, service);

    const { data: existing } = await admin
      .from("affiliate_partners")
      .select("id")
      .eq("owner_user_id", userData.user.id)
      .eq("platform_name", platformName)
      .maybeSingle();

    if (existing) {
      return send({ error: "This platform is already registered" }, 409);
    }

    const { data, error } = await admin
      .from("affiliate_partners")
      .insert({
        owner_user_id: userData.user.id,
        platform_name: platformName,
        website_url: website || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return send({
      success: true,
      message: "Affiliate partner application submitted",
      partner: data,
    });
  } catch (error) {
    console.error(error);
    return send({ error: "Could not register affiliate partner" }, 500);
  }
});
