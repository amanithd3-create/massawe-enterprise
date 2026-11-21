
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "Please sign in first" }, 401);
    }

    const token = authHeader.slice(7);

    const authClient = createClient(supabaseUrl, anonKey);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return respond({ error: "Invalid login session" }, 401);
    }

    const body = await req.json();

    const businessName = String(body.business_name || "").trim();
    const country = String(body.country || "Tanzania").trim();

    if (businessName.length < 2 || businessName.length > 120) {
      return respond({ error: "Enter a valid business name" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: seller, error } = await adminClient
      .from("sellers")
      .upsert(
        {
          owner_user_id: authData.user.id,
          business_name: businessName,
          country,
        },
        { onConflict: "owner_user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error(error);
      return respond({ error: "Could not register seller" }, 400);
    }

    return respond({
      success: true,
      message: "Seller application submitted",
      seller,
    });
  } catch (error) {
    console.error(error);
    return respond({ error: "Internal server error" }, 500);
  }
});
