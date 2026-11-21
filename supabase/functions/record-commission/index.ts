
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const webhookSecret = Deno.env.get("COMMISSION_WEBHOOK_SECRET");
    const suppliedSecret = req.headers.get("x-webhook-secret");

    if (!webhookSecret || !suppliedSecret || suppliedSecret !== webhookSecret) {
      return respond({ error: "Unauthorized payment notification" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server configuration missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    const orderReference = String(body.order_reference || "").trim();
    const idempotencyKey = String(body.idempotency_key || "").trim();
    const listingId = String(body.listing_id || "").trim();

    const saleAmount = Number(body.sale_amount);
    const currency = String(body.currency || "TZS").toUpperCase();

    if (!orderReference || !idempotencyKey || !listingId) {
      return respond({
        error: "Order reference, idempotency key and listing ID are required"
      }, 400);
    }

    if (
      !Number.isFinite(saleAmount) ||
      saleAmount <= 0 ||
      !["TZS", "USD"].includes(currency)
    ) {
      return respond({ error: "Invalid sale amount or currency" }, 400);
    }

    // Check for an existing record to prevent duplicate commissions.
    const { data: existing } = await supabase
      .from("commissions")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      return respond({
        success: true,
        duplicate: true,
        commission: existing,
      });
    }

    // Only active products from approved sellers qualify.
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("id,seller_id,status")
      .eq("id", listingId)
      .eq("status", "active")
      .maybeSingle();

    if (listingError || !listing) {
      return respond({ error: "Invalid or inactive product" }, 404);
    }

    const { data: seller, error: sellerError } = await supabase
      .from("marketplace_sellers")
      .select("id,status")
      .eq("id", listing.seller_id)
      .eq("status", "approved")
      .maybeSingle();

    if (sellerError || !seller) {
      return respond({ error: "Seller is not approved" }, 400);
    }

    let affiliateId: string | null = null;

    const affiliateCode = String(body.affiliate_code || "").trim();

    if (affiliateCode) {
      const { data: affiliate } = await supabase
        .from("affiliate_partners")
        .select("id")
        .eq("affiliate_code", affiliateCode)
        .eq("status", "approved")
        .maybeSingle();

      if (!affiliate) {
        return respond({ error: "Invalid affiliate code" }, 400);
      }

      affiliateId = affiliate.id;
    }

    // MASSAWE ENTERPRISE receives 5%.
    const platformRate = 5;
    const platformCommission =
      Math.round(saleAmount * 5) / 100;

    const { data: commission, error: insertError } =
      await supabase
        .from("commissions")
        .insert({
          order_reference: orderReference,
          affiliate_id: affiliateId,
          seller_id: seller.id,
          sale_amount: saleAmount,
          platform_rate: platformRate,
          platform_commission: platformCommission,
          affiliate_commission: 0,
          currency,
          status: "pending",
          idempotency_key: idempotencyKey,
        })
        .select("*")
        .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return respond({
          success: true,
          duplicate: true,
          message: "Commission already recorded",
        });
      }

      console.error(insertError);
      return respond({ error: "Could not record commission" }, 500);
    }

    return respond({
      success: true,
      message: "Commission recorded",
      commission,
      platform_rate: "5%",
      platform_commission: platformCommission,
      currency,
    });

  } catch (error) {
    console.error(error);
    return respond({ error: "Internal server error" }, 500);
  }
});
