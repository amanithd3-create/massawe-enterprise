
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
    const currency = String(body.currency || "TZS").toUpperCase();

    if (!title || title.length > 200) {
      return send({ error: "Enter a valid product title" }, 400);
    }

    if (!Number.isFinite(price) || price <= 0) {
      return send({ error: "Enter a valid product price" }, 400);
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return send({ error: "Invalid currency code" }, 400);
    }

    const admin = createClient(url, service);

    const { data: seller, error: sellerError } = await admin
      .from("sellers")
      .select("id,status")
      .eq("owner_user_id", userData.user.id)
      .maybeSingle();

    if (sellerError) throw sellerError;

    if (!seller || seller.status !== "active") {
      return send({ error: "An active seller account is required" }, 403);
    }

    const image = body.image_url ? String(body.image_url).trim() : null;

    if (image) {
      try {
        if (new URL(image).protocol !== "https:") throw new Error();
      } catch {
        return send({ error: "Image URL must use HTTPS" }, 400);
      }
    }

    const { data, error } = await admin
      .from("affiliate_products")
      .insert({
        title,
        description: String(body.description || ""),
        image_url: image,
        price,
        currency,
        source_type: "marketplace",
        seller_id: seller.id,
        affiliate_partner_id: null,
        is_active: false,
      })
      .select()
      .single();

    if (error) throw error;

    return send({
      success: true,
      message: "Product submitted for approval",
      product: data,
    });
  } catch (error) {
    console.error(error);
    return send({ error: "Could not create product" }, 500);
  }
});
