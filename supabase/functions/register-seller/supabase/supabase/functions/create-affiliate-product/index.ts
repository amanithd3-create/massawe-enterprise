
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
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return send({ error: "Sign in required" }, 401);
    }

    const client = createClient(url, anon);
    const { data: userData, error: authError } =
      await client.auth.getUser(auth.slice(7));

    if (authError || !userData.user) {
      return send({ error: "Invalid session" }, 401);
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const price = Number(body.price);
    const affiliateUrl = String(body.affiliate_url || "").trim();
    const currency = String(body.currency || "TZS").toUpperCase();

    if (!title || title.length > 200) {
      return send({ error: "Enter a valid product title" }, 400);
    }

    if (!Number.isFinite(price) || price <= 0) {
      return send({ error: "Enter a valid price" }, 400);
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return send({ error: "Invalid currency code" }, 400);
    }

    try {
      const parsed = new URL(affiliateUrl);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      return send({ error: "A valid HTTPS affiliate URL is required" }, 400);
    }

    const admin = createClient(url, service);

    const { data: partner, error: partnerError } = await admin
      .from("affiliate_partners")
      .select("id,status")
      .eq("owner_user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (partnerError) throw partnerError;

    if (!partner) {
      return send({ error: "An active affiliate partner account is required" }, 403);
    }

    const { data, error } = await admin
      .from("affiliate_products")
      .insert({
        title,
        description: String(body.description || ""),
        image_url: body.image_url || null,
        price,
        currency,
        source_type: "affiliate",
        seller_id: null,
        affiliate_partner_id: partner.id,
        affiliate_url: affiliateUrl,
        external_product_id: body.external_product_id
          ? String(body.external_product_id)
          : null,
        is_active: false,
      })
      .select()
      .single();

    if (error) throw error;

    return send({
      success: true,
      message: "Affiliate product submitted for approval",
      product: data,
    });
  } catch (error) {
    console.error(error);
    return send({ error: "Could not create affiliate product" }, 500);
  }
});
